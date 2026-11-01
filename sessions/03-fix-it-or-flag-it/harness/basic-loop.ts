// Act 1: the naive loop. No SPEC, no CHANGELOG, no FIX/ASK/FLAG contract — just the error, and for
// a locator failure, a page snapshot (what pasting a screenshot into chat would show). That's enough
// to locate a renamed element, but never enough to judge whether a changed value is legitimate —
// which is the actual gap scenarios 2-4 exist to demonstrate.
// Runs the whole scenarios suite once, then blindly asks the model to fix every failure it finds.
// npm run basic-loop
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

type Failure = { file: string; title: string; error: string; snapshot: string | null };

/** A locator timeout (element never found) is the only kind a page snapshot can actually help with —
 *  a value mismatch just shows the same wrong number the error already reported. */
function isLocatorFailure(error: string): boolean {
  return /waiting for getByTestId|Timeout .* exceeded/.test(error);
}

function discoverFailures(): Failure[] {
  let raw = '';
  try {
    raw = execSync('npx playwright test --project=scenarios --reporter=json', { cwd: root, encoding: 'utf-8' });
  } catch (err: any) {
    raw = err.stdout ?? '';
  }
  const report = JSON.parse(raw);
  const failures: Failure[] = [];
  for (const suite of report.suites) {
    for (const spec of suite.specs) {
      const result = spec.tests[0].results[0];
      if (result.status === 'passed') continue;
      const error = stripAnsi(result.error?.message ?? '');
      // Read now, into memory: a later rerun (to verify a fix) wipes test-results/ and takes this with it.
      let snapshot: string | null = null;
      if (isLocatorFailure(error)) {
        const snapshotPath = result.attachments?.find((a: any) => a.name === 'error-context')?.path;
        snapshot = snapshotPath ? fs.readFileSync(snapshotPath, 'utf-8') : null;
      }
      failures.push({ file: suite.file, title: spec.title, error, snapshot });
    }
  }
  return failures;
}

/** For scenario 01 (locator drift): shows what data-testid the button actually carries right now,
 *  since a role-based fix (the lesson here) never references it. */
async function liveCheckoutButtonTestId(): Promise<string | null> {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3456/cart?scenario=1');
    return await page.locator('#proceed-btn').getAttribute('data-testid');
  } finally {
    await browser.close();
  }
}

function rerun(file: string): boolean {
  try {
    execSync(`npx playwright test --project=scenarios ${file}`, { cwd: root, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const countAssertions = (src: string) => (src.match(/expect\(/g) ?? []).length;
// Descriptive only here — basic-loop has no guardrail to enforce this, unlike agentic-harness.ts.
// Capturing whether it reached for a hard wait anyway is exactly the point of the eval comparison.
const containsHardWait = (src: string) => /waitForTimeout\s*\(|setTimeout\s*\(|\bsleep\s*\(/.test(src);

type LogRow = {
  scenario: string;
  result: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  assertionsBefore: number;
  assertionsAfter: number;
  containsHardWait: boolean;
};

function appendBasicLoopLog(model: string, results: LogRow[]) {
  const logPath = path.join(root, 'logs', 'basic-loop-log.json');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const existing: unknown[] = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf-8')) : [];
  existing.push({ timestamp: new Date().toISOString(), model, results });
  fs.writeFileSync(logPath, JSON.stringify(existing, null, 2) + '\n');
  return existing.length;
}

console.log('resetting all scenarios');
execSync('npx tsx scripts/reset.ts all', { cwd: root, stdio: 'inherit' });

console.log('\nrunning the whole scenarios suite once...');
const failures = discoverFailures();
console.log(`found ${failures.length} failure(s): ${failures.map((f) => f.file).join(', ')}`);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5-5';
const scenarioOf = (file: string) => file.match(/scenarios\/(\d+)\//)?.[1] ?? file;
const summary: { scenario: string; result: string }[] = [];
const log: LogRow[] = [];

for (const failure of failures) {
  const specPath = path.join(root, failure.file);
  const originalSpec = fs.readFileSync(specPath, 'utf-8');

  console.log(`\n=== ${failure.file} ===`);
  console.log(`asking ${model} to fix it (bare prompt, no spec, no changelog, no contract${failure.snapshot ? ', just a page snapshot' : ''})...`);

  const startedAt = Date.now();
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    // Same reasoning depth as agentic-harness.ts, so a side-by-side eval isn't comparing a
    // deliberately-dumbed-down naive loop against a harder-thinking contract.
    output_config: { effort: 'medium' },
    messages: [
      {
        role: 'user',
        content:
          'Fix this failing test.\n\n' +
          `Test file (${failure.file}):\n\`\`\`ts\n${originalSpec}\n\`\`\`\n\n` +
          `Test failure:\n\`\`\`\n${failure.error}\n\`\`\`\n\n` +
          (failure.snapshot ? `Page snapshot at the moment it failed:\n\`\`\`\n${failure.snapshot}\n\`\`\`\n\n` : '') +
          'Reply with only the full corrected contents of the test file, in a single ts code block.',
      },
    ],
  });
  const latencyMs = Date.now() - startedAt;

  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const match = text.match(/```(?:ts|typescript)?\n([\s\S]*?)```/);
  if (!match) {
    console.error('model reply had no code block:\n', text);
    continue;
  }

  fs.writeFileSync(specPath, match[1]);

  console.log(`--- diff (${failure.file}) ---`);
  try {
    execSync(`diff -u "${specPath}.baseline" "${specPath}"`, { encoding: 'utf-8' });
  } catch (err: any) {
    console.log(err.stdout);
  }

  const passed = rerun(failure.file);
  console.log(passed ? `${failure.file}: now passing` : `${failure.file}: still failing`);
  summary.push({ scenario: scenarioOf(failure.file), result: passed ? 'now passing' : 'still failing' });
  log.push({
    scenario: scenarioOf(failure.file),
    result: passed ? 'now passing' : 'still failing',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
    assertionsBefore: countAssertions(originalSpec),
    assertionsAfter: countAssertions(match[1]),
    containsHardWait: containsHardWait(match[1]),
  });

  if (scenarioOf(failure.file) === '01') {
    // Best-effort narration aid, not core logic — the app's own server is torn down between
    // playwright test invocations, so this can't be allowed to take the whole run down with it.
    try {
      console.log(`live check: the checkout button's actual data-testid right now is "${await liveCheckoutButtonTestId()}"`);
    } catch {
      console.log('live check: skipped (app server not reachable right now).');
    }
  }
}

console.log('\nsummary:');
console.table(summary);

const totalRuns = appendBasicLoopLog(model, log);
console.log(`logged to logs/basic-loop-log.json (${totalRuns} run${totalRuns === 1 ? '' : 's'} recorded so far).`);

console.log('\nrerunning all scenarios together so the report reflects the final state...');
try {
  execSync('npx playwright test --project=scenarios', { cwd: root, stdio: 'inherit' });
} catch {
  // some scenarios are expected to still be red; the report is what we're after, not a clean exit.
}
