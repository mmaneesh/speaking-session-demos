# Fix It or Flag It

A small shop (`shop-app/`) with a Cart view and a Checkout view in one `index.html`, plus Playwright tests.
Scenarios are switched with `?scenario=1..4` (see `scenarios/*/README.md`).

## Layout

```
shop-app/          index.html (the app) and server.ts
pages/             page objects: CartPage, CheckoutPage
fixtures/          test.ts (fixtures), data.ts (prices and expected totals), storage.ts (cart setup)
tests/
  cart/            quantity, remove, persistence
  checkout/        summary, place-order, navigation
  journey/         one end-to-end purchase
  contract/        checks the demo itself: each scenario changes exactly one thing
scenarios/
  01/ ... 04/    test.spec.ts, README.md, answer-key.json — folder names stay neutral on purpose
                 (the real path is fed into the model's prompt; a descriptive name would leak the answer)
SPEC.md  CHANGELOG.md                   the only context the AI gets besides the failing test
scripts/reset.ts                        restore a scenario's starting state
```

## Run

```
npm run serve                  start the shop on http://localhost:3456
npm test                       regression tests (must be green)
npm run test:cart | test:checkout
npm run test:s1 .. test:s4     one demo scenario (red by design for 1, 3, 4)
npm run reset -- 2             restore scenario 2 (test file and CHANGELOG.md); no argument resets all
npm run typecheck
```

## Why scenario tests do not use page objects

The loop may edit one file: that scenario's `test.spec.ts`. The locator or expected value it has to fix must
be in that file. With a page object, the fix would live in a file the AI cannot touch. So scenario tests stay
flat on purpose, and `tests/contract` enforces it. The regression tests use page objects and fixtures.
