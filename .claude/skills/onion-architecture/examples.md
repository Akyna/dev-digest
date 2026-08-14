# Examples

All code below is from this repo. "Bad" excerpts are real, current files —
they are the documented backlog, not invented straw men.

## The real thing: `modules/repos/`

The smallest complete four-layer path in the codebase. Follow one request
down and back:

**Layer 4 — `modules/repos/routes.ts`** (transport only, 48 lines):

```ts
export default async function reposRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new RepoService(app.container);

  app.post('/repos', { schema: { body: RepoInput } }, async (req, reply) => {
    const { workspaceId, userId } = await getContext(app.container, req);
    const { repo, created } = await service.add(workspaceId, userId, req.body.url);
    reply.status(created ? 201 : 200);
    return repo;
  });
}
```

No `drizzle-orm` import. No `db/schema`. The handler validates, resolves
tenancy, delegates, and picks a status code.

**Layer 2 — `modules/repos/service.ts`** (the use case):

```ts
async add(workspaceId: string, userId: string, url: string) {
  const { owner, name } = parseRepoUrl(url);          // layer 0 — helpers.ts
  const fullName = `${owner}/${name}`;

  const existing = await this.repo.findByFullName(workspaceId, fullName);
  if (existing) return { repo: toRepoDto(existing), created: false };

  const row = await this.repo.insert({ workspaceId, owner, name, fullName, createdBy: userId });
  await this.container.jobs.enqueue(workspaceId, CLONE_JOB_KIND, { ... });

  return { repo: toRepoDto(row), created: true };
}
```

Note `toRepoDto(row)` on both exits — the `RepoRow` never escapes.

**Layer 3 — `modules/repos/repository.ts`** (the only file touching the
table):

```ts
async findByFullName(workspaceId: string, fullName: string): Promise<RepoRow | undefined> {
  const [row] = await this.db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, fullName)));
  return row;
}
```

Every query scoped by `workspaceId` — the tenancy guard lives here, once,
instead of at every call site.

## Bad: Drizzle in the route handler

`modules/workspace/routes.ts` today — the whole file. Query construction,
tenancy scoping, and DTO mapping all inside the handler:

```ts
export default async function workspaceRoutes(app: FastifyInstance) {
  const { container } = app;

  app.get('/workspace', async (req) => {
    const { workspaceId } = await getContext(container, req);
    const repos = await container.db
      .select()
      .from(t.repos)
      .where(eq(t.repos.workspaceId, workspaceId));
    return {
      workspaceId,
      cloneDir: container.config.cloneDir,
      repos: repos.map((r) => ({
        id: r.id,
        full_name: r.fullName,
        clone_path: r.clonePath,
        last_polled_at: r.lastPolledAt?.toISOString() ?? null,
        cloned: Boolean(r.clonePath),
      })),
    };
  });
}
```

There is no seam here. Testing this endpoint requires a real Postgres, and
the `full_name` / `clone_path` snake_case mapping is invisible to anyone
grepping `helpers.ts` for DTO shapes.

## Good: the same endpoint, layered

```ts
// modules/workspace/repository.ts — layer 3
export class WorkspaceRepository {
  constructor(private db: Db) {}

  async listRepos(workspaceId: string): Promise<RepoRow[]> {
    return this.db.select().from(t.repos).where(eq(t.repos.workspaceId, workspaceId));
  }
}

// modules/workspace/helpers.ts — layer 0, pure
export function toWorkspaceRepoDto(r: RepoRow) {
  return {
    id: r.id,
    full_name: r.fullName,
    clone_path: r.clonePath,
    last_polled_at: r.lastPolledAt?.toISOString() ?? null,
    cloned: Boolean(r.clonePath),
  };
}

// modules/workspace/service.ts — layer 2
export class WorkspaceService {
  private repo: WorkspaceRepository;
  constructor(private container: Container) {
    this.repo = new WorkspaceRepository(container.db);
  }

  async overview(workspaceId: string) {
    const rows = await this.repo.listRepos(workspaceId);
    return {
      workspaceId,
      cloneDir: this.container.config.cloneDir,
      repos: rows.map(toWorkspaceRepoDto),
    };
  }
}

// modules/workspace/routes.ts — layer 4
export default async function workspaceRoutes(app: FastifyInstance) {
  const service = new WorkspaceService(app.container);

  app.get('/workspace', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.overview(workspaceId);
  });
}
```

`toWorkspaceRepoDto` is now unit-testable with a plain object, and
`overview()` is testable against an injected repository.

## Bad: resolving an adapter inside a handler

`modules/pulls/routes.ts:41`:

```ts
app.get('/repos/:id/pulls', { schema: { params: IdParams } }, async (req) => {
  const { workspaceId } = await getContext(container, req);
  const [repo] = await container.db.select().from(t.repos).where(...);
  if (!repo) throw new NotFoundError('Repo not found');

  let gh: GitHubClient | null = null;
  try {
    gh = await container.github();
  } catch (err) {
    app.log.warn({ err }, 'GitHub client unavailable; serving persisted PRs');
  }
  // ...80 more lines of sync + upsert
});
```

The degrade-gracefully behaviour here is *good product logic* — it's just in
the wrong layer. It can't be reused by the polling job, which reimplements
the same upsert loop in `modules/polling/routes.ts`.

## Good: the adapter resolved in the service

```ts
// modules/pulls/service.ts — layer 2
async listPulls(workspaceId: string, repoId: string): Promise<PrMeta[]> {
  const repo = await this.repo.getById(workspaceId, repoId);
  if (!repo) throw new NotFoundError('Repo not found');

  // Local-first: sync when a token is configured, never fail the read.
  const gh = await this.tryGithub();
  if (gh) await this.syncFromGitHub(workspaceId, repo, gh);

  return (await this.repo.listByRepo(workspaceId, repoId)).map(toPrMetaDto);
}

private async tryGithub(): Promise<GitHubClient | null> {
  try {
    return await this.container.github();
  } catch {
    return null;   // no token / offline — persisted PRs stay viewable
  }
}
```

`syncFromGitHub` is now callable from the polling job too, and a test injects
`new MockGitHubClient({ ... })` through `ContainerOverrides` to drive both
branches without a network.

## Adding a new port

The `RepoIntel` facade is the precedent — its own header states the rule:
*"Library complexity (@ast-grep/napi, dependency-cruiser, graphology,
tokenizer) hides behind the `RepoIntel` facade; features import THIS, never
the libraries."*

**1. Declare the port** in `modules/<name>/types.ts` (layer 1) — not in the
vendored `vendor/shared/adapters.ts`:

```ts
export interface CoverageReader {
  read(repoPath: string, files: string[]): Promise<Map<string, number>>;
}
```

**2. Implement it** in `src/adapters/coverage/lcov.ts` (layer 3). This is
the only file allowed to import the parsing library.

**3. Wire it** as a lazy getter plus an override entry in
`platform/container.ts`:

```ts
export interface ContainerOverrides {
  // ...
  coverage?: CoverageReader;
}

get coverage(): CoverageReader {
  if (this.overrides.coverage) return this.overrides.coverage;
  this._coverage ??= new LcovCoverageReader();
  return this._coverage;
}
```

**4. Consume it** from a service via `this.container.coverage` — never from
a route, never by importing `LcovCoverageReader`.

**5. Test it** by injecting a double, no new mock infrastructure needed:

```ts
const app = await buildApp({
  config,
  overrides: { coverage: { read: async () => new Map([['src/a.ts', 0.42]]) } },
});
```

Skipping step 3 is the common failure: an adapter that isn't overridable
forces every consumer's test onto the real implementation.

## Transaction boundary

The pattern for new multi-write flows. Service opens, repository accepts:

```ts
// repository — accepts an executor, never opens one
export class PullRepository {
  constructor(private db: Db) {}

  async replaceFiles(prId: string, files: PrFile[], tx: Db | Transaction = this.db) {
    await tx.delete(t.prFiles).where(eq(t.prFiles.pullRequestId, prId));
    if (files.length) await tx.insert(t.prFiles).values(files);
  }

  async replaceCommits(prId: string, commits: PrCommit[], tx: Db | Transaction = this.db) {
    await tx.delete(t.prCommits).where(eq(t.prCommits.pullRequestId, prId));
    if (commits.length) await tx.insert(t.prCommits).values(commits);
  }
}

// service — owns the boundary, because only it knows the operation's scope
async syncPrDetail(prId: string, detail: PrDetail): Promise<void> {
  await this.container.db.transaction(async (tx) => {
    await this.repo.replaceFiles(prId, detail.files, tx);
    await this.repo.replaceCommits(prId, detail.commits, tx);
  });
}
```

The default parameter keeps every existing single-write call site unchanged
— `replaceFiles(prId, files)` still works — so this is additive, not a
migration.

Compare with `modules/pulls/routes.ts:242-265` today, where the same four
statements run bare in a handler: a crash after the delete leaves the PR
with no files and no commits, and nothing retries.
