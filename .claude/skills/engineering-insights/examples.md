# Vague vs. useful entries

The bar: **"if this would be obvious to anyone reading the code, don't write
it"** and **"would this save 5+ minutes next time?"** Every entry below the
line fails at least one of those; every entry above it passes both.

## What Doesn't Work / Recurring Errors & Fixes

Bad:
> Promises can be tricky.

Good:
> `Promise.all()` on the data-ingestion pipeline times out after ~30 items.
> Switch to `Promise.allSettled()` with batches of 10 for that module.

Bad:
> Be careful with the database layer.

Good:
> `postgres` client silently truncates query params over 65535 bytes instead
> of erroring — hit this importing a large diff. Chunk the insert in
> `src/modules/pulls/store.ts`.

## Codebase Patterns

Bad:
> Careful with async.

Good:
> Checkout-flow state always goes through `cartStore.ts` (Zustand) — three
> components share the cart, local `useState` silently desyncs one of them.

## Tool & Library Notes

Bad:
> Tests can be flaky.

Good:
> The `.it.test.ts` integration suite requires a locally running mock
> service on port 3001 — `pnpm test` alone will hang, not fail, if it's not
> up.

## Decisions worth remembering (Codebase Patterns / Open Questions)

Bad:
> We picked Postgres.

Good:
> Chose Postgres over Redis for the run-cache table — needed ACID guarantees
> for concurrent review writes, not just speed. Don't swap it for a cache
> store without re-checking that constraint.

---

Two tests, both must pass before an entry gets written:

1. **Obviousness test** — a developer reading the surrounding code would not
   already know this.
2. **Value test** — it would save someone 5+ minutes the next time they hit
   it.
