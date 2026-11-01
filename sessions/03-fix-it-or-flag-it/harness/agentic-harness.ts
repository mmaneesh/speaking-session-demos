// Act 2: the FIX / ASK / FLAG contract. Every citation is verified verbatim against its named
// source before the harness trusts it. Only a verified FIX ever touches a file, and it is
// reverted if the fix doesn't actually make the test pass.
//   npm run harness             decide all 4 scenario failures from one run
//   npm run harness -- 02       restrict to failures whose path contains "02" (e.g. after
//                                `npm run reset -- 2`, to show the FIX flip once evidence exists)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
const read = (p: string) => fs.readFileSync(p, 'utf-8');

type Failure = { file: string; title: string; error: string; evidence: string };

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
      // Read now, into memory: a later rerun (to verify a FIX) wipes test-results/ and takes this with it.
      const evidencePath = result.attachments?.find((a: any) => a.name === 'error-context')?.path;
      const evidence = evidencePath ? read(evidencePath) : error;
      failures.push({ file: suite.file, title: spec.title, error, evidence });
    }
  }
  return failures;
}

/** For scenario 01 (locator drift): the button's text never changes, so the citation alone doesn't
 *  show the audience anything moved. This shows what data-testid it actually carries right now. */
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

function rerunPasses(file: string): boolean {
  try {
    execSync(`npx playwright test --project=scenarios ${file}`, { cwd: root, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** Playwright's own error shape tells us which rule applies: an element that can't be found
 *  at all is a locator problem, not a value dispute. */
function failureKind(error: string): 'locator' | 'value' {
  return /waiting for getByTestId|Timeout .* exceeded/.test(error) ? 'locator' : 'value';
}

const CitationSchema = z.object({ source: z.enum(['SPEC.md', 'CHANGELOG.md', 'failure']), quote: z.string() });
const DecisionSchema = z.object({
  decision: z.enum(['FIX', 'ASK', 'FLAG']),
  reason: z.string(),
  citations: z.array(CitationSchema),
  proposedTest: z.string().optional(),
});
type Decision = z.infer<typeof DecisionSchema>;

const decideTool = {
  name: 'decide',
  description: 'Record the FIX/ASK/FLAG triage decision for this failing test.',
  input_schema: {
    type: 'object' as const,
    properties: {
      decision: { type: 'string', enum: ['FIX', 'ASK', 'FLAG'] },
      reason: { type: 'string', description: 'Why this decision, in plain language.' },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string', enum: ['SPEC.md', 'CHANGELOG.md', 'failure'] },
            quote: { type: 'string', description: 'Copied verbatim from the named source. No paraphrasing.' },
          },
          required: ['source', 'quote'],
        },
      },
      proposedTest: { type: 'string', description: 'Full corrected test file contents. Only set this when decision is FIX.' },
    },
    required: ['decision', 'reason', 'citations'],
  },
};

/** Never trust the model's claim that evidence exists — check the named source ourselves. */
function verify(citations: Decision['citations'], sources: Record<string, string>) {
  return citations.map((c) => ({ ...c, valid: sources[c.source]?.includes(c.quote) ?? false }));
}

function hasValid(verified: ReturnType<typeof verify>, source: string) {
  return verified.some((c) => c.source === source && c.valid);
}

const SPEC = read(path.join(root, 'SPEC.md'));

async function decide(anthropic: Anthropic, model: string, failure: Failure, originalSpec: string, changelog: string, evidence: string): Promise<Decision> {
  const prompt = `You are triaging one failing test. Call the \`decide\` tool with your answer.

Rules:
- FIX for a missing element: only if SPEC.md still describes this action's required behaviour, AND the page snapshot below shows a matching element (by role/visible name). Cite both SPEC.md and "failure".
- FIX for a changed value: only if CHANGELOG.md documents this exact change. Cite the changelog entry.
- ASK: if no changelog entry documents a value change, say so plainly. Do not guess, and do not propose a test edit.
- FLAG: if the numbers contradict SPEC.md's own rules (e.g. Total must equal Subtotal + Shipping, and it doesn't), regardless of the changelog. Cite the SPEC rule and the failing line from "failure". Do not propose a test edit.
Every citation's quote must be copied exactly from the named source — no paraphrasing, no summarizing.

=== SPEC.md ===
${SPEC}

=== CHANGELOG.md ===
${changelog}

=== Test file (${failure.file}) ===
${originalSpec}

=== Failure (error + page snapshot) ===
${evidence}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    tools: [decideTool],
    messages: [{ role: 'user', content: `${prompt}\n\nYou must respond by calling the decide tool — not with plain text.` }],
  });

  const call = response.content.find((b) => b.type === 'tool_use');
  if (!call || call.type !== 'tool_use') throw new Error('model did not call the decide tool');
  return DecisionSchema.parse(call.input);
}

async function main() {
  const filter = process.argv[2];

  console.log('running the whole scenarios suite once...');
  let failures = discoverFailures();
  if (filter) failures = failures.filter((f) => f.file.includes(filter));
  console.log(`triaging ${failures.length} failure(s): ${failures.map((f) => f.file).join(', ') || '(none)'}`);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5-5';
  const changelog = read(path.join(root, 'CHANGELOG.md'));
  const scenarioOf = (file: string) => file.match(/scenarios\/(\d+)\//)?.[1] ?? file;
  const summary: { scenario: string; decision: string; outcome: string }[] = [];

  for (const failure of failures) {
    const specPath = path.join(root, failure.file);
    const originalSpec = read(specPath);
    const evidence = failure.evidence;

    console.log(`\n=== ${failure.file} ===`);
    let result: Decision;
    try {
      result = await decide(anthropic, model, failure, originalSpec, changelog, evidence);
    } catch (err: any) {
      console.log(`action: REJECTED — model did not return a usable decision (${err.message}). Needs a human.`);
      summary.push({ scenario: scenarioOf(failure.file), decision: '—', outcome: 'REJECTED — needs human' });
      continue;
    }
    console.log(`decision: ${result.decision}`);
    console.log(`reason: ${result.reason}`);

    const sources: Record<string, string> = { 'SPEC.md': SPEC, 'CHANGELOG.md': changelog, failure: evidence };
    const verified = verify(result.citations, sources);
    for (const c of verified) console.log(`  citation [${c.source}]: ${c.valid ? 'VERIFIED' : 'NOT FOUND VERBATIM — rejected'} — "${c.quote}"`);

    const kind = failureKind(failure.error);
    const requirementMet =
      result.decision === 'FIX'
        ? kind === 'locator'
          ? hasValid(verified, 'SPEC.md') && hasValid(verified, 'failure')
          : hasValid(verified, 'CHANGELOG.md')
        : result.decision === 'FLAG'
          ? hasValid(verified, 'SPEC.md') && hasValid(verified, 'failure')
          : true; // ASK needs no citation — it's declaring evidence is missing

    if (result.decision === 'FIX') {
      if (!requirementMet || !result.proposedTest) {
        console.log('action: REJECTED — FIX requires verified evidence of the right kind plus a proposed test. Leaving the test untouched; needs a human.');
        summary.push({ scenario: scenarioOf(failure.file), decision: result.decision, outcome: 'REJECTED — needs human' });
        continue;
      }
      fs.writeFileSync(specPath, result.proposedTest);
      if (rerunPasses(failure.file)) {
        console.log('action: wrote the fix — verified passing.');
        summary.push({ scenario: scenarioOf(failure.file), decision: result.decision, outcome: 'fixed — now passing' });
        if (scenarioOf(failure.file) === '01') {
          console.log(`live check: the checkout button's actual data-testid right now is "${await liveCheckoutButtonTestId()}"`);
        }
      } else {
        fs.writeFileSync(specPath, originalSpec);
        console.log('action: the proposed fix did NOT make the test pass — reverted. Needs a human.');
        summary.push({ scenario: scenarioOf(failure.file), decision: result.decision, outcome: 'reverted — needs human' });
      }
    } else if (result.decision === 'FLAG') {
      const outcome = requirementMet ? 'flagged for a human' : 'flagged (unverified — extra suspicion)';
      console.log(requirementMet ? 'action: flagged for a human (no file touched).' : 'action: flagged, but evidence did not verify — treat with extra suspicion. No file touched.');
      summary.push({ scenario: scenarioOf(failure.file), decision: result.decision, outcome });
    } else {
      console.log('action: asked a human (no file touched).');
      summary.push({ scenario: scenarioOf(failure.file), decision: result.decision, outcome: 'asked a human' });
    }
  }

  console.log('\nsummary:');
  console.table(summary);

  console.log('\nrerunning the triaged scenario(s) together so the report reflects the final state...');
  try {
    execSync(`npx playwright test --project=scenarios ${failures.map((f) => f.file).join(' ')}`, { cwd: root, stdio: 'inherit' });
  } catch {
    // some scenarios are expected to still be red; the report is what we're after, not a clean exit.
  }
}

main();
