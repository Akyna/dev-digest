# server — insights

Append-only log of non-obvious lessons learned while working in this package —
things the code and README won't tell you. One entry per discovery: what
surprised you, why it matters going forward.

<!-- ## YYYY-MM-DD — short title
     what happened, why it matters -->

## What Works

### 2026-07-31 — a removed course-lesson feature has a commit that *is* its spec

Re-adding per-run cost took minutes instead of hours because the removal was one
labelled commit: `git show d45ab0d` ("feat(reviews): remove per-PR/run cost, keep
model pricing") listed every call site, in reverse. Same for `58c6ac7` (timeline
tokens) and `e07efea` (PR-list findings column). Before building anything that
feels like it "should already exist" here, `git log --oneline --all | grep -i
'remove\|chore(l0'` — the starter repo strips lesson features deliberately, and
the strip commit names all the seams.

## Codebase Patterns

### 2026-07-31 — the two `vendor/shared` mirrors are NOT byte-identical

`server/src/vendor/shared` and `client/src/vendor/shared` have drifted in
comments (e.g. `PromptAssembly`'s slot docs say "T1.3 / T3" server-side,
"repo-intel" client-side). They must be edited in lockstep, but you cannot
`cp` one over the other — apply the same targeted edit to each.

## Tool & Library Notes

### 2026-07-31 — Drizzle types numeric aggregates as `string`

`sum(t.agentRuns.costUsd)` in `src/modules/pulls/routes.ts` returns
`string | null`, not `number | null` — Postgres numerics come back as strings and
Drizzle keeps that. Without an explicit `Number()` the value ships as `"0.014"`
in JSON and blows up the moment a zod contract with `z.number()` is attached as a
response schema. `SUM` semantics are otherwise a gift: it skips NULL rows and
returns NULL only when every row is NULL, which is exactly "no known price".

## Recurring Errors & Fixes

### 2026-07-31 — `tsconfig` excludes `test/`, so contract drift only bites at runtime

`tsconfig.json` has `"include": ["src/**/*.ts"]`. `pnpm typecheck` therefore says
nothing about `test/`, and zod fixtures (`RunTrace.parse({...})` in
`contracts.test.ts`) take `unknown` anyway — so adding a required field to a
vendored contract passes typecheck and fails as a red test. When you change a
contract, run `pnpm test`, not just `pnpm typecheck`.
