# e2e — insights

Append-only log of non-obvious lessons learned while working in this package —
things the code and README won't tell you. One entry per discovery: what
surprised you, why it matters going forward.

<!-- ## YYYY-MM-DD — short title
     what happened, why it matters -->

## 2026-07-31 — `./scripts/e2e.sh` needs two things the script doesn't install

The script boots the whole hermetic stack (Postgres :5433, API :3101, web :3100)
before it ever reaches the runner, so both failure modes cost you a full boot:

1. `npm install` inside `e2e/` — this package is npm-based, and `pnpm install`
   at the root does not cover it. Without it: `sh: tsx: command not found`.
2. The `agent-browser` binary on PATH. Without it every flow fails identically
   with `spawn agent-browser ENOENT` — which looks like 7 broken flows but is
   one missing dependency.

Note `reviewer-core/` is npm-based too; running `pnpm test` there generates a
stray `pnpm-lock.yaml` + `pnpm-workspace.yaml`. Use `npx vitest run`.
