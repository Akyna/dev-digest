---
name: onion-architecture
description: Onion Architecture for the DevDigest backend — which layer a piece of code belongs to in server/ and reviewer-core/, and what each layer is allowed to import. Use this whenever adding or editing a route, service, repository, adapter, or port; when adding a module under server/src/modules/; when asked "where should this logic go", "why can't the route query the database", or about backend folder structure, layering, dependency direction, ports and adapters, or the DI Container — even if the skill isn't named. Defers Fastify request-lifecycle mechanics to fastify-best-practices and query construction to drizzle-orm-patterns; this skill decides only where code lives and what it may depend on.
---

# Onion Architecture — backend layer boundaries

Which layer a file belongs to, and what it may import. The dependency rule is what makes this repo's test strategy
affordable: every hermetic test swaps a real adapter for a mock through `ContainerOverrides` — one line in
`buildApp({ overrides })` — and that only works while every external call sits behind a port. The moment a route reaches
for `container.db` or
`await container.github()` directly, that seam is gone for that endpoint and the only way left to test it is a real
Postgres container. Four modules have already crossed that line; see [Known violations](#known-violations). For sourcing
and rationale, see [references.md](references.md). For real before/after code from this repo,
see [examples.md](examples.md).

Scope: `server/` and `reviewer-core/`. The client is governed by
[react-architecture](../react-architecture/SKILL.md) instead.

## The dependency rule

**Code may import inward, never outward.** A file may depend on its own layer and any layer below it in this table, and
on nothing above it.

| # | Layer          | Lives in                                                                  | May import                    |
|---|----------------|---------------------------------------------------------------------------|-------------------------------|
| 0 | Domain         | `reviewer-core/src/`, `modules/*/helpers.ts`, `vendor/shared/contracts/`  | stdlib, `zod`, layer 0        |
| 1 | Ports          | `vendor/shared/adapters.ts`, `modules/*/types.ts`                         | layer 0                       |
| 2 | Application    | `modules/*/service.ts`, `run-executor.ts`, `pipeline/*`                   | layers 0–1, `platform/errors` |
| 3 | Infrastructure | `modules/*/repository.ts`, `src/adapters/*`, `src/db/*`, `src/platform/*` | layers 0–2                    |
| 4 | Entrypoint     | `modules/*/routes.ts`, `app.ts`, `server.ts`, `platform/container.ts`     | everything                    |

An outer layer may call **any** inner layer directly — skipping a layer is fine, and pass-through methods that exist
only to preserve the ladder are noise. What is never fine is the reverse direction.

Two carve-outs, and they are exceptions, not precedent:

- **`platform/container.ts` is the composition root.** It sits in
  `platform/` but behaves as layer 4, and it is the *only* file permitted to import module classes (`AgentsRepository`,
  `ReviewRepository`,
  `RepoIntelService`). Wiring has to know about everything; that is its job.
- **`vendor/shared/adapters.ts` is the canonical ports file but is do-not-touch** (root `CLAUDE.md`) — it's vendored and
  edited upstream. So a *new* port goes in `modules/<name>/types.ts` instead. The precedent is the `RepoIntel` interface
  in `modules/repo-intel/types.ts`, resolved via
  `container.repoIntel`.

## Decision table — where does this go?

| You're adding…                    | Goes in                                                                             | Must not import                                                     |
|-----------------------------------|-------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| An HTTP endpoint                  | `modules/<name>/routes.ts`                                                          | `drizzle-orm`, `db/schema` — parse, delegate to the service, return |
| Use-case orchestration            | `modules/<name>/service.ts`                                                         | `fastify`, `fastify-type-provider-zod`, raw table objects           |
| A SQL query                       | `modules/<name>/repository.ts`                                                      | anything from `service.ts` or `routes.ts`                           |
| A pure calculation or DTO mapping | `modules/<name>/helpers.ts`                                                         | `drizzle-orm`, `src/db/*`, `src/adapters/*`, `fastify`              |
| A call to an external SDK         | `src/adapters/<kind>/`                                                              | `src/modules/*` — adapters don't know features exist                |
| A new external capability         | port in `modules/<name>/types.ts`, impl in `src/adapters/`, wired in `container.ts` | —                                                                   |
| A literal, timeout, or job kind   | `modules/<name>/constants.ts`                                                       | anything                                                            |
| Logic a second module needs       | hoist to `platform/` or expose via the container                                    | don't import `modules/A/*` from `modules/B/*`                       |
| Config or a secret                | `platform/config.ts` / `container.secrets`                                          | never `process.env` outside `config.ts`                             |

## The canonical module shape

```
modules/<name>/
  routes.ts        # Fastify plugin — schema, getContext, delegate, return
  service.ts       # use cases; owns transactions; no SQL, no HTTP
  repository.ts    # the ONLY file touching this feature's tables
  helpers.ts       # pure functions: parsing, row → DTO mapping
  constants.ts     # job kinds, secret names, limits
  types.ts         # ports + feature types (only when the feature defines one)
```

`modules/repos/` is the smallest complete reference: a 48-line `routes.ts`
that does nothing but validate and delegate, a `service.ts` that owns the clone job and enqueues follow-ups, and an
87-line `repository.ts` whose header already states the rule — *"The ONLY place that touches the `repos`
table."*

Two scale-up escapes already exist in the repo and are sanctioned:

- **Split the repository behind a facade** when one feature spans several tables — `modules/reviews/repository.ts`
  re-exports
  `repository/{review,run,pull}.repo.ts`. Callers still see one repository.
- **Add a `pipeline/` folder** when a use case is genuinely multi-step —
  `modules/repo-intel/pipeline/{full,incremental,rank,repo-map,walk}.ts`. Pipeline files are layer 2, same rules as
  `service.ts`.

Not every file is required — `workspace/` legitimately has no constants — but when the concern exists it goes in its own
file at this location. A
`service.ts` over ~200 lines is the signal to extract an executor (`modules/reviews/run-executor.ts`) or a pipeline, not
to keep growing.

## Ports and adapters

Every call that leaves the process — LLM, GitHub, git, ripgrep, embeddings, secrets — goes behind an interface.
`vendor/shared/adapters.ts` says it outright: *"ALL external calls go behind these interfaces."* The payoff is concrete:
`adapters/mocks.ts` has a deterministic double for every port, and
`MockLLMProvider.completeStructured` validates its fixture against the real Zod schema, so a contract change fails a
test instead of shipping.

Rules:

- The SDK import (`openai`, `octokit`, `simple-git`, `@ast-grep/napi`) may appear only under `src/adapters/`. Nowhere
  else.
- `src/adapters/**` must not import `src/modules/**`. An adapter that needs a feature's type has the dependency
  backwards — move the type to
  `vendor/shared/contracts` or invert the call.
- Register a new adapter as a lazy getter on `Container` plus an entry in
  `ContainerOverrides`, so tests can inject a double. An adapter that isn't overridable isn't finished.

## DI: the Container is the composition root

This repo hand-rolls DI (`platform/container.ts`) rather than using awilix or tsyringe. Services take the whole
`Container` and resolve what they need from it:

```ts
export class RepoService {
    private repo: RepoRepository;

    constructor(private container: Container) {
        this.repo = new RepoRepository(container.db);
    }
}
```

Keep this. It is a service locator, and the honest cost is that the constructor no longer declares what the service
actually depends on — you have to read the body to find out it needs `git`, `secrets`, and `jobs`. The mitigation is
cheap: **resolve the ports you need in the constructor**, as `RepoService` does with `RepoRepository`, so the dependency
surface is visible at the top of the class instead of scattered through methods.

What the Container is *not* is a licence for routes to do work.
`routes.ts` may read `app.container` to construct its service and to call
`getContext` — that's it. `await container.github()` or `container.db` in a handler is the violation, not the container
itself.

## Don't leak persistence inward

Drizzle `$inferSelect` row types stop at `repository.ts`. Services and routes speak DTOs from `vendor/shared/contracts`
and mapping functions in
`helpers.ts` — `toRepoDto`, `reviewToDto`, `toAgentDto`.

This matters beyond tidiness: a row type is the *database's* shape, and
`db/rows.ts` re-exports it repo-wide. Once a service signature mentions
`AgentRow`, renaming a column becomes an API-contract change. The repository is the translation boundary; that's the
whole reason it exists.

Related: repository methods should be named for the business operation, not the SQL — `updateClonePath`,
`workspaceIdFor`, `findByFullName`, not
`updateColumns`.

## Transactions

**This is the one rule the repo does not yet follow anywhere.**
`grep -rn "\.transaction(" server/src` returns zero matches, and
`pulls/routes.ts` deletes then re-inserts `prFiles` and `prCommits`
non-atomically — a crash between the two leaves a PR with no files.

The rule for new code:

- The **service** owns the transaction boundary, because only it knows the scope of the business operation.
- The **repository** accepts an optional executor and never opens its own transaction:
  `async insert(values: InsertRepo, tx: Db | Transaction = this.db)`.
- Anything that must succeed or fail together goes in one boundary.

Don't retrofit transactions into unrelated changes — but don't add a new multi-write flow without one.

## Known violations

Documented backlog, not a template. **When you touch one of these files, extract toward the canonical shape rather than
extending the flat one.**

| Rule broken                | Where                                                        | What                                                                                       |
|----------------------------|--------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| routes must not build SQL  | `modules/pulls/routes.ts`                                    | 18 direct `container.db` calls, `await container.github()` in handlers, inline DTO mapping |
| routes must not build SQL  | `modules/polling/routes.ts`                                  | repo lookup + PR upsert loop inline; no service, no repository                              |
| routes must not build SQL  | `modules/settings/routes.ts`                                 | settings read + upsert loop inline; has `helpers.ts`, no service                            |
| routes must not build SQL  | `modules/workspace/routes.ts`                                | Drizzle select + DTO mapping inline — 34 lines, the cheapest one to fix                     |
| rows stop at the repository| `modules/reviews/service.ts:4`, `modules/reviews/run-executor.ts` | import `AgentRow` from `db/rows.js`                                                    |
| helpers.ts is pure         | `modules/repos/helpers.ts`                                   | `import * as t from '../../db/schema.js'` for one row type; should be `import type { RepoRow } from './repository.js'`, as `agents/helpers.ts` does |
| adapters know no features  | `adapters/astgrep/index.ts`, `adapters/depgraph/index.ts`    | both import `modules/repo-intel/constants.js` — and astgrep's own header says features never import it |
| no cross-module imports    | `modules/repos/service.ts:11-14`                             | imports `modules/repo-intel/constants.js`                                                   |
| no cycles                  | `modules/agents/helpers.ts` ↔ `modules/agents/repository.ts` | `AgentRow` is declared in `repository.ts` and imported back by `helpers.ts`; move it to a `types.ts` to break it |

One cycle is **not** on this list and never will be: every service does
`import type { Container }` while `platform/container.ts` imports the module back. A composition root closes cycles by
construction — that is the standing cost of the service-locator DI this repo chose, not a defect to fix.

## Related skills

- [fastify-best-practices](../fastify-best-practices/SKILL.md) — how to write the route itself: hooks, schemas,
  serialization, error handling.
- [drizzle-orm-patterns](../drizzle-orm-patterns/SKILL.md) — how to write the query; this skill only says it belongs in
  `repository.ts`.
- [postgresql-table-design](../postgresql-table-design/SKILL.md) — the schema the repository sits on top of.
- [zod](../zod/SKILL.md) — the contracts in `vendor/shared` that cross the layer boundaries.
- [engineering-insights](../engineering-insights/SKILL.md) — read
  `server/INSIGHTS.md` before working here; log what you learn after.
