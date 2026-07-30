# e2e — CLAUDE.md

`@devdigest/e2e` — deterministic browser e2e for the web app, driven by Vercel
**agent-browser** (native Rust+CDP CLI). No Playwright, no LLM, no API key.

## Stack

`agent-browser` CLI (`npm i -g agent-browser && agent-browser install`) +
`run.ts`, a thin runner that plays a JSON list of commands per flow against one
shared browser session.

## Commands

`./scripts/e2e.sh` (**preferred** — hermetic: isolated Postgres :5433 / API
:3101 / web :3100, freshly seeded, torn down after) · `pnpm test` (`tsx run.ts`,
against your own running dev stack — only safe if its DB has *only* the seeded
demo repo) · `pnpm typecheck`.

## Structure

`specs/NN-name.flow.json` — flow fixtures, each a `{ name, steps[] }` list of
`agent-browser` commands run in order · `run.ts` — the runner · `lib/` — runner
helpers. Locators are deterministic only (`--url`, `--text`, `find`); the AI
`chat` command is never used, so runs stay key-free and stable.

## Non-default conventions

- `specs/` here is **test fixtures** (flow JSON), not the docs-spec convention — feature specs for this package live in `docs/specs/` instead.
- Flows target read-only seeded data (`acme/payments-api`, PR #482) — nothing triggers a model call.

## Do-not-touch

- Never `docker compose down -v` to "reset" — deletes the `devdigest_pgdata` volume (every imported repo/review), including for the hermetic runner's assumptions about dev stack state.

## Read when

- How a flow works, coverage table, env knobs → `README.md`
- Design decisions, deep dives for this module → `docs/`
- Feature specs before adding/changing a flow → `docs/specs/`
- Gotchas discovered while working in this package → `INSIGHTS.md`
