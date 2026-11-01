# Speaking Session Demos

Code behind a recurring speaking series on AI agents applied to QA and testing. Each talk gets its own
self-contained demo under `sessions/`, with its own `package.json`, its own tooling, and its own README —
nothing is shared between them.

## Sessions

- **Session #1** — *Practical Usage of Skills & Plugins in QA's Everyday Workflow* (not in this repo yet)
- **Session #2** — *Guardrails & Evals* (not in this repo yet)
- **Session #3** — [`sessions/03-fix-it-or-flag-it/`](sessions/03-fix-it-or-flag-it/) — *Fix It or Flag It: Loop Engineering & The Agent Harness*. A naive AI loop vs. a FIX/ASK/FLAG contract with evidence citations, permissions, a bounded retry loop, and a hard-wait guardrail — wrapped around a small shop app with five deliberately engineered test failures.

More sessions land here as they're built.

## Working on a session

Each session folder is independent — `cd` into it and follow its own README. None of them share dependencies
or build tooling, so there's nothing to set up at the repo root.
