# reviewer-core — insights

Append-only log of non-obvious lessons learned while working in this package —
things the code and README won't tell you. One entry per discovery: what
surprised you, why it matters going forward.

<!-- ## YYYY-MM-DD — short title
     what happened, why it matters -->

## Tool & Library Notes

### 2026-07-31 — this package is npm-based; `pnpm test` pollutes the working tree

Despite the root docs saying pnpm, `reviewer-core/` carries a `package-lock.json`.
`pnpm test` here fails on an `ERR_PNPM_IGNORED_BUILDS` gate for `esbuild` **and**
leaves behind a stray `pnpm-lock.yaml` + `pnpm-workspace.yaml` that then show up
as untracked files in `git status`. Run `npx vitest run` instead.

## Codebase Patterns

### 2026-07-31 — the engine computes cost the server may not persist

`src/review/run.ts` returns `ReviewOutcome.costUsd`, summed per chunk from
`StructuredResult.costUsd`, which prefers OpenRouter's real `usage.cost` over the
injected `estimateCost` hook. Whether that number is *stored* is entirely the
server's call — for a while `run-executor.ts` destructured it out and dropped it.
If cost looks missing, check the consumer before suspecting the engine.

### 2026-07-31 — an unpriced chunk poisons the whole run's cost to `null`

`costUsd = costUsd == null || res.costUsd == null ? null : costUsd + res.costUsd`
(`src/review/run.ts:184`). In map-reduce mode one unknown-price chunk makes the
entire run unpriced rather than reporting a partial total. Deliberate: a partial
sum presented as the run's cost is a lie. Downstream must render `null` as "—",
never `$0.00`.
