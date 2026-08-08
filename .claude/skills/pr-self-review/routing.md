# Routing table — path → skill

Single source of truth for which project skill reviews which changed paths. This is a
maintained table, not inferred from each skill's frontmatter `description` — descriptions
are written for prose trigger-matching, not path prediction, and two skills are vendored
with hashes pinned in `skills-lock.json` (their descriptions can change under us on the next
sync, silently changing routing if we relied on them).

**Update this table whenever a skill is added, removed, or its scope changes** (enforced by
INV-9 in `invariants.md`).

Match against `CHANGED[]` (from `git diff --name-status`, minus excluded paths — see
`SKILL.md` phase 3). A row fires when `CHANGED ∩ globs` is non-empty, and (for
content-triggered rows) the diff for that subset also matches the regex.

## UI lane (`client/`)

| Skill | Path globs | Content trigger | Gates? |
|---|---|---|---|
| `react-architecture` | `client/**` | only when the subset contains **added / renamed / deleted** files (it judges placement, not content — a pure edit to an existing file's body doesn't need a placement review) | yes |
| `react-best-practices` | `client/**/*.tsx`, `client/src/lib/hooks/**`, `client/src/lib/*.tsx` | — | yes |
| `next-best-practices` | `client/src/app/**`, `client/next.config.*`, `client/src/middleware.*` | or diff adds `'use client'` / `'use server'` anywhere under `client/` | yes |
| `react-testing-library` | `client/**/*.test.tsx`, `client/**/*.test.ts`, `client/src/test/**` | — | warn-only |

## Backend lane (`server/`, `reviewer-core/`)

| Skill | Path globs | Content trigger | Gates? |
|---|---|---|---|
| `onion-architecture` | `server/src/modules/**`, `server/src/adapters/**`, `server/src/platform/**`, `reviewer-core/src/**` | — | yes |
| `fastify-best-practices` | `server/src/**/routes.ts`, `server/src/app.ts`, `server/src/server.ts`, `server/src/platform/{errors,sse,resilience,jobs}.ts` | — | yes |
| `drizzle-orm-patterns` | `server/src/db/**`, `server/src/**/repository.ts` | — | yes |
| `postgresql-table-design` | `server/src/db/schema/**`, `server/src/db/schema.ts`, `server/src/db/migrations/**` | — | yes |

## Cross-cutting lane (always considered)

| Skill | Path globs | Content trigger | Gates? |
|---|---|---|---|
| `security` | any `**/*.{ts,tsx,js,mjs,sql,yml,sh}` change, plus `.githooks/**` (extensionless git hooks) | always runs when any such file changed | yes |
| `typescript-expert` | `**/*.d.ts`, `**/tsconfig*.json` | or diff adds `: any`, `as unknown as`, `@ts-ignore`, or a non-null `!.` assertion | warn-only |
| `zod` | `server/src/vendor/shared/contracts/**` | or the changed file imports `zod` | yes |

## Excluded from review

| Skill | Why |
|---|---|
| `mermaid-diagram` | authoring aid, produces no reviewable invariant |
| `engineering-insights` | runs **after** the gate, as the session wrap-up — never gates |

## Uncovered surface (no project skill — handled by invariants + built-ins only)

- `e2e/**` — routed to the `code-review` correctness lane; also see INV-6.
- `.github/workflows/**` — see INV-8 only.

## Built-in lanes (always run, whole diff, not path-scoped)

- `code-review` — correctness lane. Effort `medium` by default; `high` when the diff touches
  `server/src/modules/**` or `reviewer-core/**`.
- `security-review` — security lane, complements the `security` rubric skill above.

## Algorithm (implemented in `SKILL.md` phase 3)

1. Build `CHANGED[]` (path + A/M/D/R status) from the diff.
2. Drop excluded paths: `**/node_modules/**`, `dist/`, `.next/`, `test-results/`,
   `server/clones/**`, `*.lock`, `pnpm-lock.yaml`, `package-lock.json`.
3. For each row above, compute `SUBSET(skill) = CHANGED ∩ globs`, and where a content-trigger
   is listed, additionally require `git diff "$BASE" -- <subset> | grep -qE '<pattern>'`.
4. Emit a job per skill with a non-empty subset. **Cap: max 6 rubric lanes per run** — if more
   match, keep the ones with the largest subsets and note the drop in the report.
5. Always additionally emit the `code-review` and `security-review` lanes on the whole diff.
6. Each rubric lane runs as one `Task` subagent, given only that skill's `SKILL.md` (plus its
   `examples.md`/`references.md` if present) and only its file subset — it must not comment on
   anything outside that scope.
