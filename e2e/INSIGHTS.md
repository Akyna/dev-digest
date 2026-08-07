# e2e — insights

Append-only log of non-obvious lessons learned while working in this package —
things the code and README won't tell you. One entry per discovery: what
surprised you, why it matters going forward.

<!-- ## YYYY-MM-DD — short title
     what happened, why it matters -->

## Recurring Errors & Fixes

### 2026-07-31 — `sh: tsx: command not found` — this package needs its own `npm install`

`./scripts/e2e.sh` boots the entire hermetic stack (Postgres :5433, API :3101,
web :3100, fresh seed) *before* it reaches the runner, so a missing local
dependency costs a full boot to discover. `e2e/` is npm-based and a root
`pnpm install` does not cover it: run `npm install` inside `e2e/` once.

### 2026-07-31 — all 7 flows failing with `spawn agent-browser ENOENT` is ONE missing binary

The runner shells out to the `agent-browser` CLI per flow, so when it isn't on
PATH every flow fails identically and the summary reads `0/7 flows passed` — it
looks like a broad regression, not a setup gap. Tell them apart by the error
text: identical ENOENT across unrelated flows (`03-agents`, `06-onboarding`,
`07-settings`) means the binary, not the app. Fix per `CLAUDE.md`:
`npm i -g agent-browser && agent-browser install`.
