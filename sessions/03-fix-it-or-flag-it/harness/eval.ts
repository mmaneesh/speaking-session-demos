// Evaluates both harnesses as black boxes, across models and repeated trials — the same way a
// real eval would, by shelling out to the actual npm scripts and reading back what they logged.
// Measures six dimensions: accuracy, groundedness, fix-success rate, consistency/reliability,
// cost + latency, and guardrail adherence.
//   npm run eval                 full sweep, per harness.eval.config.json
//   npm run eval -- 2            2 trials per model/harness instead of the config's default (quick smoke test)
// What to run (models, trial count, scenarios, pricing) lives in harness/eval.config.json, not
// here — so changing the sweep never means touching this file's logic.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => fs.readFileSync(p, 'utf-8');

type EvalConfig = {
  models: string[];
  trials: number;
  scenarios: string[];
  pricing: Record<string, { in: number; out: number }>;
};

const config: EvalConfig = JSON.parse(read(path.join(root, 'harness', 'eval.config.json')));
const MODELS = config.models;
const TRIALS = Number(process.argv[2]) || config.trials;
const PRICING = config.pricing;

const answerKeys: Record<string, { correctCall: string }> = {};
for (const s of config.scenarios) {
  answerKeys[s] = JSON.parse(read(path.join(root, 'scenarios', s, 'answer-key.json')));
}

const EVAL_RUNS_DIR = path.join(root, 'logs', 'eval-runs');
function writeTrialArtifact(model: string, harness: 'agentic-harness' | 'basic-loop', trial: number, entry: unknown) {
  fs.mkdirSync(EVAL_RUNS_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVAL_RUNS_DIR, `${model}__${harness}__trial${trial}.json`), JSON.stringify(entry, null, 2) + '\n');
}

/** A scenario test failing is expected and handled inside the harness scripts — it never makes
 *  them exit non-zero. So a non-zero exit here always means the script itself crashed (API error,
 *  rate limit, etc.), and that must stay visible rather than silently look like a clean trial. */
function run(cmd: string, env: Record<string, string>) {
  try {
    execSync(cmd, { cwd: root, env: { ...process.env, ...env }, stdio: 'pipe' });
  } catch (err: any) {
    const stderr = err?.stderr?.toString().trim().slice(-500) ?? '';
    console.warn(`\n  ⚠ "${cmd}" crashed — this trial will be missing from the results.${stderr ? `\n    ${stderr}` : ''}`);
  }
}

function tailEntries(logPath: string, countBefore: number): any[] {
  if (!fs.existsSync(logPath)) return [];
  const all = JSON.parse(read(logPath));
  return all.slice(countBefore);
}

function entryCount(logPath: string): number {
  if (!fs.existsSync(logPath)) return 0;
  return JSON.parse(read(logPath)).length;
}

// ─────────────────────── agentic-harness.ts (the contract) ───────────────────────

type HarnessResult = {
  scenario: string;
  decision: string;
  outcome: string;
  needsHuman: boolean;
  citationsValid: number;
  citationsTotal: number;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  hadGuardrailViolation: boolean;
};

function evalHarness(model: string) {
  const logPath = path.join(root, 'logs', 'run-log.json');
  const before = entryCount(logPath);

  for (let i = 0; i < TRIALS; i++) {
    process.stdout.write(`  trial ${i + 1}/${TRIALS}...`);
    run('npm run reset', {});
    run('npx tsx harness/agentic-harness.ts', { CLAUDE_MODEL: model });
    const [entry] = tailEntries(logPath, before + i);
    if (entry) writeTrialArtifact(model, 'agentic-harness', i + 1, entry);
    process.stdout.write(' done\n');
  }

  const trials = tailEntries(logPath, before) as { results: HarnessResult[] }[];
  const rows: HarnessResult[] = trials.flatMap((t) => t.results);

  return scoreHarness(rows);
}

function scoreHarness(rows: HarnessResult[]) {
  const byScenario = new Map<string, HarnessResult[]>();
  for (const r of rows) byScenario.set(r.scenario, [...(byScenario.get(r.scenario) ?? []), r]);

  let correct = 0;
  let consistencySum = 0;
  let citationsValidSum = 0;
  let citationsTotalSum = 0;
  let fixAttempts = 0;
  let fixSuccesses = 0;
  let guardrailViolations = 0;
  let fixOrGuardrailAttempts = 0;

  for (const [scenario, trials] of byScenario) {
    const want = answerKeys[scenario].correctCall;
    const decisions = trials.map((t) => t.decision);
    correct += decisions.filter((d) => d === want).length;

    const counts = new Map<string, number>();
    for (const d of decisions) counts.set(d, (counts.get(d) ?? 0) + 1);
    const modeCount = Math.max(...counts.values());
    consistencySum += modeCount / trials.length;

    for (const t of trials) {
      citationsValidSum += t.citationsValid;
      citationsTotalSum += t.citationsTotal;
      if (t.decision === 'FIX') {
        fixAttempts++;
        if (t.outcome.startsWith('fixed')) fixSuccesses++;
      }
      fixOrGuardrailAttempts++;
      if (t.hadGuardrailViolation) guardrailViolations++;
    }
  }

  const totalInputTokens = rows.reduce((s, r) => s + r.inputTokens, 0);
  const totalOutputTokens = rows.reduce((s, r) => s + r.outputTokens, 0);
  const totalLatencyMs = rows.reduce((s, r) => s + r.latencyMs, 0);

  return {
    accuracy: pct(correct, rows.length),
    groundedness: citationsTotalSum > 0 ? pct(citationsValidSum, citationsTotalSum) : null,
    fixSuccessRate: fixAttempts > 0 ? pct(fixSuccesses, fixAttempts) : null,
    consistency: pct(consistencySum, byScenario.size),
    guardrailAdherence: pct(fixOrGuardrailAttempts - guardrailViolations, fixOrGuardrailAttempts),
    avgInputTokens: Math.round(totalInputTokens / rows.length),
    avgOutputTokens: Math.round(totalOutputTokens / rows.length),
    avgLatencyMs: Math.round(totalLatencyMs / rows.length),
    totalInputTokens,
    totalOutputTokens,
  };
}

// ───────────────────────── basic-loop.ts (the naive loop) ─────────────────────────

type LoopResult = {
  scenario: string;
  result: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  assertionsBefore: number;
  assertionsAfter: number;
  containsHardWait: boolean;
};

function evalBasicLoop(model: string) {
  const logPath = path.join(root, 'logs', 'basic-loop-log.json');
  const before = entryCount(logPath);

  for (let i = 0; i < TRIALS; i++) {
    process.stdout.write(`  trial ${i + 1}/${TRIALS}...`);
    run('npm run reset', {});
    run('npx tsx harness/basic-loop.ts', { CLAUDE_MODEL: model });
    const [entry] = tailEntries(logPath, before + i);
    if (entry) writeTrialArtifact(model, 'basic-loop', i + 1, entry);
    process.stdout.write(' done\n');
  }

  const trials = tailEntries(logPath, before) as { results: LoopResult[] }[];
  const rows: LoopResult[] = trials.flatMap((t) => t.results);
  return scoreBasicLoop(rows);
}

/** basic-loop has no FIX/ASK/FLAG — it always attempts a fix. The nearest honest reading of
 *  "correct" for a system that can't ask or flag: a FIX scenario is right if it ends up passing;
 *  an ASK/FLAG scenario is right only if it refuses to force a false pass (and doesn't get there
 *  by quietly dropping an assertion). */
function scoreBasicLoop(rows: LoopResult[]) {
  const byScenario = new Map<string, LoopResult[]>();
  for (const r of rows) byScenario.set(r.scenario, [...(byScenario.get(r.scenario) ?? []), r]);

  let correct = 0;
  let consistencySum = 0;
  let fixAttempts = 0;
  let fixSuccesses = 0;
  let hardWaitCount = 0;

  for (const [scenario, trials] of byScenario) {
    const want = answerKeys[scenario].correctCall;
    for (const t of trials) {
      const endedPassing = t.result === 'now passing';
      const keptAssertions = t.assertionsAfter >= t.assertionsBefore;
      const isCorrect = want === 'FIX' ? endedPassing : !endedPassing && keptAssertions;
      if (isCorrect) correct++;
      if (t.containsHardWait) hardWaitCount++;
    }

    const results = trials.map((t) => t.result);
    const counts = new Map<string, number>();
    for (const r of results) counts.set(r, (counts.get(r) ?? 0) + 1);
    const modeCount = Math.max(...counts.values());
    consistencySum += modeCount / trials.length;

    if (want === 'FIX') {
      fixAttempts += trials.length;
      fixSuccesses += trials.filter((t) => t.result === 'now passing').length;
    }
  }

  const totalInputTokens = rows.reduce((s, r) => s + r.inputTokens, 0);
  const totalOutputTokens = rows.reduce((s, r) => s + r.outputTokens, 0);
  const totalLatencyMs = rows.reduce((s, r) => s + r.latencyMs, 0);

  return {
    accuracy: pct(correct, rows.length),
    groundedness: null, // basic-loop has no citation concept at all
    fixSuccessRate: fixAttempts > 0 ? pct(fixSuccesses, fixAttempts) : null,
    consistency: pct(consistencySum, byScenario.size),
    guardrailAdherence: pct(rows.length - hardWaitCount, rows.length), // descriptive — nothing enforces this here
    avgInputTokens: Math.round(totalInputTokens / rows.length),
    avgOutputTokens: Math.round(totalOutputTokens / rows.length),
    avgLatencyMs: Math.round(totalLatencyMs / rows.length),
    totalInputTokens,
    totalOutputTokens,
  };
}

// ───────────────────────────────── shared ─────────────────────────────────

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

function cost(model: string, inputTokens: number, outputTokens: number) {
  const price = PRICING[model];
  return Math.round((inputTokens * price.in + outputTokens * price.out) / 1e4) / 100; // dollars, 2dp
}

async function main() {
  console.log(`running the eval: ${MODELS.length} models x 2 harnesses x ${TRIALS} trials each`);
  console.log('this shells out to the real harness scripts, so it costs real API calls and takes real time.\n');

  const summary: Record<string, any> = {};

  for (const model of MODELS) {
    console.log(`\n=== ${model} — agentic-harness.ts ===`);
    const harnessScore = evalHarness(model);
    summary[`${model} / agentic-harness`] = {
      ...harnessScore,
      estCostUSD: cost(model, harnessScore.totalInputTokens, harnessScore.totalOutputTokens),
    };

    console.log(`\n=== ${model} — basic-loop.ts ===`);
    const loopScore = evalBasicLoop(model);
    summary[`${model} / basic-loop`] = {
      ...loopScore,
      estCostUSD: cost(model, loopScore.totalInputTokens, loopScore.totalOutputTokens),
    };
  }

  console.log('\n\nfinal results (% unless noted; cost is total for all trials, not per-decision):\n');
  console.table(
    Object.entries(summary).map(([key, s]) => ({
      run: key,
      accuracy: s.accuracy,
      groundedness: s.groundedness,
      fixSuccess: s.fixSuccessRate,
      consistency: s.consistency,
      guardrail: s.guardrailAdherence,
      avgLatencyMs: s.avgLatencyMs,
      estCostUSD: s.estCostUSD,
    })),
  );

  const summaryPath = path.join(root, 'logs', 'eval-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({ timestamp: new Date().toISOString(), trials: TRIALS, summary }, null, 2) + '\n');
  console.log(`\nfull breakdown written to logs/eval-summary.json`);
}

main();
