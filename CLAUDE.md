# DevDigest — root map

Local-first AI PR review. Course starter. 4 standalone packages, **no real
monorepo** — each has its own `package.json`/lockfile; cross-package code is
shared via tsconfig path aliases, not published modules.

## Stack

Node ≥22 · pnpm ≥10 · Docker (Postgres/pgvector only — API and web run on host).

## Structure

| `server/`        | Fastify API + Drizzle/Postgres, repo-intel indexer | :3001 |
| `client/`        | Next.js 15 web app (the studio)                    | :3000 |
| `reviewer-core/` | pure review engine (diff → LLM → grounded findings)| —     |
| `e2e/`           | agent-browser e2e (deterministic, no LLM)          | —     |

## Commands

`./scripts/dev.sh` — boots everything from zero (Postgres, env files, deps,
migrate, seed, dev servers). Flags: `--no-seed` · `--no-client` · `--db-only`.

## Before opening a PR

Run `/pr-self-review` (or let it self-trigger) — it routes your local diff to the matching
skills below and blocks the push on any unwaived CRITICAL finding. `git push --no-verify` or
`PR_SELF_REVIEW_SKIP=1 git push` bypasses it locally; see
`.claude/skills/pr-self-review/SKILL.md`.

## Gotchas

- Server does **not** migrate on boot — `cd server && pnpm db:migrate` after any schema change.
- `docker compose down -v` deletes the `devdigest_pgdata` volume — every imported repo/review is lost. Never use `-v` to "reset".
- Each package has its own `.env` — there is no shared root env file.

## Do-not-touch

- `server/src/vendor/shared` (`@devdigest/shared`) and `client/src/vendor/*` — vendored contracts/UI, edit at source not here.
- `server/src/db/migrations/*` — append-only, never hand-edit an applied migration.

## Read when

- Architecture diagram, full setup, troubleshooting → `README.md`
- Test strategy / CI workflow matrix → `TESTING.md`
- Working inside a package → that package's own `CLAUDE.md` (loads automatically by location)
- Writing/editing a reviewer agent prompt → `docs/agent-prompts/`
