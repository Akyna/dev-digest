# server — CLAUDE.md

`@devdigest/api` — Fastify + Drizzle/Postgres engine. Imports repos/PRs, indexes
with repo-intel, runs `reviewer-core`, persists grounded findings. Adapters
(LLM, GitHub, git, ast-grep, …) sit behind a DI container so they can be
swapped for mocks in tests.

## Stack

Fastify 5 (`helmet`, `rate-limit`, `cors`, `fastify-sse-v2` for streaming run
traces) · Drizzle ORM · `postgres` (pgvector). Zod contracts from
`src/vendor/shared` double as route schemas via `fastify-type-provider-zod` —
one definition drives request validation **and** response serialization.

## Commands

`pnpm dev` (:3001) · `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:generate` ·
`pnpm typecheck` · `pnpm test` (unit: `--exclude '**/*.it.test.ts'` — hermetic;
`.it.test` — real Postgres via testcontainers).

## Structure

`src/modules/<name>/` — self-contained feature plugins (repos, pulls, agents,
reviews, repo-intel, polling, workspace, settings) · `src/adapters/` — LLM/
GitHub/git/ast-grep/codeindex/embedder behind `platform/container.ts` (DI) ·
`src/platform/` — config, jobs, SSE, prompts, resilience (cross-cutting).

Layering inside a module is `routes.ts → service.ts → repository.ts`, imports
pointing inward only — routes never build SQL, services never import Fastify,
row types stop at the repository. `repos/` is the reference; `pulls`,
`polling`, `settings`, `workspace` predate the rule and are the known
exceptions. Full rules: `.claude/skills/onion-architecture/SKILL.md`.

## Non-default conventions

- No keys required to boot — every secret optional in `platform/config.ts`; can be set at runtime via the Settings UI.
- Secrets live in `~/.devdigest/secrets.json`, not `.env`.
- DB schema already contains every table for every course lesson — unused ones sit empty until a lesson fills them.

## Do-not-touch

- `src/vendor/shared` — vendored, edit upstream not here.
- `src/db/migrations/` — append-only, never edit an applied migration.

## Read when

- Full API map, adapter diagrams, secrets flow, testing detail → `README.md`
- Design decisions, deep dives for this module → `docs/`
- Feature specs before implementing a module → `docs/specs/`
- Gotchas discovered while working in this package → `INSIGHTS.md`
