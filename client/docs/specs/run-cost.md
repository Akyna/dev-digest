# Run cost — UI

What a review costs, on the three screens where the question comes up. Data
contract and provenance: `server/docs/specs/run-cost.md`.

## Formatting

One helper — `src/lib/format-cost.ts` — shared by all three surfaces, so the
same run never reads as two different numbers.

| Input | Output | Why |
|---|---|---|
| `null` / `undefined` | `—` | Price unknown. **Never `$0.00`** — that would claim the run was free. |
| `0` | `$0` | Genuinely free model (e.g. `z-ai/glm-4.7-flash`). |
| `0.00002` | `<$0.0001` | Below display resolution, still non-zero. |
| `0.0013` | `$0.0013` | Sub-cent runs keep 4 decimals or they'd all read `$0.00`. |
| `0.014` | `$0.014` | |
| `0.06` | `$0.06` | Trailing zeros trimmed to a 2-decimal floor. |
| `1.25` | `$1.25` | |

Roughly two significant digits throughout. Not to be confused with
`src/lib/model-label.ts`, which formats **catalog** prices per 1M tokens for the
model pickers.

## Surface 1 — PR list column

`src/app/repos/[repoId]/pulls/` — a `COST` column between STATUS and UPDATED.

The column is declarative: `COLUMN_KEYS` + `GRID` in `constants.ts` drive both
the header (via `list.columns.cost`) and the cell order in `PRRow`. Adding a
column means adding a grid track **and** a key — they must stay in step or every
row silently misaligns.

Value = the PR's **total** across all its runs. A PR nobody has reviewed shows
`—`, the same fallback the score ring already uses.

## Surface 2 — Agent-runs timeline

`.../pulls/[number]/_components/RunHistory/RunHistory.tsx` — under the run's
timestamp, `9,119 tok · $0.0013`.

Tokens and cost each render only if present, so an errored run (no tokens, no
price) shows the timestamp alone and keeps its inline error message.

## Surface 3 — Run trace drawer

`.../RunTraceDrawer/_components/TraceBody/TraceBody.tsx` — a `COST` tile in the
Stats row, between TOKENS and FINDINGS, reading `trace.stats.cost_usd`.

## Tests

`src/lib/format-cost.test.ts` pins the table above. Each surface has a component
test for the priced and the unpriced case — the `—` path is the one that
regresses, because a `?? 0` anywhere upstream turns "unknown" into "free".
