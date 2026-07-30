# client — insights

Append-only log of non-obvious lessons learned while working in this package —
things the code and README won't tell you. One entry per discovery: what
surprised you, why it matters going forward.

<!-- ## YYYY-MM-DD — short title
     what happened, why it matters -->

## Codebase Patterns

### 2026-07-31 — the PR-list table has three coupled constants, not one

`src/app/repos/[repoId]/pulls/constants.ts` holds `GRID` (the grid-template) and
`COLUMN_KEYS` (header labels, resolved as `list.columns.<key>`), and `PRRow`
renders one bare `<div>` per track in that same order. Adding a column means
touching all three plus the i18n file; miss one and every row silently misaligns
with no error. Note `s.headCell(alignRight)` right-aligns by *index*
(`i === COLUMN_KEYS.length - 1`), so inserting a column before the last one moves
which header is right-aligned.

### 2026-07-31 — formatting helpers are co-located, so cross-surface ones need a home in `lib/`

There is no shared `lib/format.ts`; each feature keeps its own `helpers.ts`
(e.g. `formatSeconds`/`formatTokens` in `RunTraceDrawer/helpers.ts`). That breaks
down for a formatter used by several unrelated routes — `formatCost` is shared by
the PR list, the run timeline and the trace drawer, so it lives in
`src/lib/format-cost.ts` alongside `src/lib/model-label.ts`. Use `lib/` only when
2+ route trees need it; otherwise stay co-located.

### 2026-07-31 — some i18n namespaces have no consuming component yet

`messages/en/agentPerformance.json` ships a full cost vocabulary (`totalCost`,
`costByAgent`, `costByModel`, `table.cost`) that nothing renders — it belongs to
an unbuilt screen. Finding a key here is not evidence the feature exists; grep
for the `useTranslations` namespace before assuming it's wired.
