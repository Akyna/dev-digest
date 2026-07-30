# server — insights

Append-only log of non-obvious lessons learned while working in this package —
things the code and README won't tell you. One entry per discovery: what
surprised you, why it matters going forward.

<!-- ## YYYY-MM-DD — short title
     what happened, why it matters -->

## 2026-07-31 — tsconfig excludes `test/`, so contract drift only bites at runtime

`tsconfig.json` has `"include": ["src/**/*.ts"]`. `pnpm typecheck` therefore says
nothing about `test/`, and zod fixtures (`RunTrace.parse({...})` in
`contracts.test.ts`) take `unknown` anyway — so adding a required field to a
vendored contract passes typecheck and fails as a red test. When you change a
contract, run `pnpm test`, not just `pnpm typecheck`.

## 2026-07-31 — the two `vendor/shared` mirrors are NOT byte-identical

`server/src/vendor/shared` and `client/src/vendor/shared` have drifted in
comments (e.g. `PromptAssembly`'s slot docs say "T1.3 / T3" server-side,
"repo-intel" client-side). They must be edited in lockstep, but you cannot
`cp` one over the other — apply the same targeted edit to each.
