# 05 Hydration race (reader only, never shown to the AI)

**What changes in the app:** nothing wrong — the checkout summary's totals come from a (simulated) pricing service that takes ~500ms to respond. The page shows a placeholder ("…") immediately, then fills in the real, correct numbers shortly after. Visible on stage at `?scenario=5`.

**Why the test fails:** it reads each value with `.textContent()` the instant after clicking checkout — a single snapshot, no retry — and compares it with a plain `expect(...).toBe(...)`. At that moment the real numbers haven't arrived yet, so it reads the placeholder and fails. Give it half a second and the same values would be correct.

**Right call: FIX.** This is a test-authoring defect, not a SPEC or CHANGELOG question — the test itself just isn't resilient to normal async rendering. The fix is to switch to Playwright's web-first, polling assertion (`await expect(locator).toHaveText(...)`), which waits for the real value instead of grabbing whatever's on screen right now.

**The guardrail this exists for:** the tempting "quick fix" is to add a wait — `page.waitForTimeout(600)` — which would also make the test pass. The harness hard-rejects any proposed fix containing a fixed wait or sleep, regardless of whether it would pass, because it's a band-aid: slower CI, still technically racy under different conditions, and it teaches nothing about why the test was wrong. The correct fix needs zero hard waits.

**Evidence:** no SPEC.md or CHANGELOG.md citation needed — this isn't a behavior dispute. The evidence is the test's own code pattern (`.textContent()` + `.toBe()` instead of a polling assertion) plus the failing comparison itself.
