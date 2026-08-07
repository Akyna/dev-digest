# Run cost — data & API

Every agent run records what it cost in USD, and the PR list exposes the total
per PR. **No extra model calls**: the number arrives inside the response we
already pay for.

## Where the number comes from

```
OpenRouter usage.cost ─┐
                       ├→ StructuredResult.costUsd → ReviewOutcome.costUsd
PriceBook / PRICING  ──┘        (per chunk)            (summed over chunks)
                                                              │
                                          agent_runs.cost_usd ┘
```

- `reviewer-core/src/llm/openrouter.ts` sends `usage: { include: true }` to
  OpenRouter and reads the **real generation cost** back from `usage.cost`.
- When the provider doesn't report one (OpenAI, Anthropic, or a cold price
  cache), the injected `estimateCost` hook falls back to `PriceBook`
  (`src/platform/price-book.ts`, live OpenRouter prices, 6h TTL) and then to the
  static table in `src/adapters/llm/pricing.ts`.
- Unknown model ⇒ `null`, propagated as-is. `reviewer-core/src/review/run.ts`
  sums per-chunk costs and **poisons the sum to `null` if any chunk is
  unpriced** — a partial total would be a lie.

## Storage

`agent_runs.cost_usd double precision NULL` (migration `0010_faulty_shadow_king`).

Nullable on purpose. `NULL` means *the price is unknown*, which is a different
fact from *this run was free* (`0`, e.g. `z-ai/glm-4.7-flash`). Failed and
cancelled runs write `NULL`.

Runs from before this migration stay `NULL` forever — there is **no backfill**.
Token counts alone can't reconstruct what OpenRouter actually charged, and an
estimate silently presented as a real price is worse than a blank.

## API surface

| Route | Field | Shape |
|---|---|---|
| `GET /pulls/:id/runs` | `RunSummary.cost_usd` | `number \| null` — one run |
| `GET /runs/:id/trace` | `RunTrace.stats.cost_usd` | `number \| null` — one run |
| `GET /repos/:id/pulls` | `PrMeta.cost_usd` | `number \| null` — **PR total** |

`PrMeta.cost_usd` is `nullish`, mirroring `score`: it is a list-endpoint rollup,
and `GET /pulls/:id` (`PrDetail`) does not compute it.

### The PR rollup

`SUM(cost_usd) … GROUP BY pr_id` over **every** run the PR has ever had, not
just the latest review — the column answers "what has this PR cost me".
Computed on read in `src/modules/pulls/routes.ts`, in the same block as the
latest-review score; the list is small, so one grouped query is cheap.

SQL `SUM` gives the null semantics for free: it skips `NULL` rows, and returns
`NULL` only when *every* run is unpriced. Drizzle types numeric aggregates as
`string`, so the result is coerced with `Number()` before it reaches JSON.

## Tests

- `test/reviews.it.test.ts` — the full path: provider usage → `agent_runs`
  → trace doc → `RunSummary`, all carrying the same number.
- `test/integration.it.test.ts` — the rollup: no runs → `null`; two priced runs
  plus one unpriced → the sum of the priced two.
- `test/contracts.test.ts` — `RunTrace` fixture parses with `cost_usd`.
