# Speaking Session Demos

Code behind a recurring speaking series on AI agents applied to QA and testing. Each talk gets its own
self-contained demo under `sessions/`, with its own `package.json`, its own tooling, and its own README —
nothing is shared between them.

## Sessions

- **Session #1** — *Practical Usage of Skills & Plugins in QA's Everyday Workflow* (not in this repo yet)
- **Session #2** — [`sessions/02-guardrails-and-evals/`](sessions/02-guardrails-and-evals/) — *Guardrails & Evals*. A contract-drift reviewer skill: an Ajv validator supplies the facts, `SKILL.md` sets hard rules for the LLM, and a three-tier eval suite (structural, process, semantic) with a `--rule-off` check proves the guardrail is what's doing the work.
- **Session #3** — [`sessions/03-fix-it-or-flag-it/`](sessions/03-fix-it-or-flag-it/) — *Fix It or Flag It: "Give an AI a loop, it'll cheat. Give it a harness, it'll confess."* A naive AI loop vs. a FIX/ASK/FLAG contract with evidence citations, permissions, a bounded retry loop, and a hard-wait guardrail — wrapped around a small shop app with five deliberately engineered test failures.

More sessions land here as they're built.

## Working on a session

Each session folder is independent — `cd` into it and follow its own README. None of them share dependencies
or build tooling, so there's nothing to set up at the repo root.
