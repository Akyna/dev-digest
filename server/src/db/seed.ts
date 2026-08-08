import 'dotenv/config';
import { createDb, type Db } from './client.js';
import * as t from './schema.js';
import { eq, and } from 'drizzle-orm';
import {
  GENERAL_REVIEWER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
  TEST_QUALITY_REVIEWER_PROMPT,
} from './seed-prompts.js';
import { SEED_SKILLS } from './seed-skills.js';

/** Default provider/model for the built-in reviewer agents. */
const DEFAULT_PROVIDER = 'openrouter' as const;
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

/**
 * Demo diffs for the skills control experiment (PR #483 / #484).
 *
 * These are REAL unified-diff hunks, not summaries. `reviews/diff-loader.ts`
 * tries `git diff` first and falls back to `diffFromPrFiles`, which glues
 * `pr_files.patch` behind a `diff --git` / `---` / `+++` header and runs it
 * through `parseUnifiedDiff`. A pr_files row with a null patch (like PR #482's)
 * contributes NOTHING to that reconstruction, so a review of it has no diff and
 * every finding is dropped by the citation-grounding gate. Keep the `@@` line
 * counts honest — grounding maps findings onto the new-side line numbers the
 * parser derives from them.
 */

/** #483 — new `getOrder` with three throw branches; only the first is exercised. */
const PR483_ORDERS_PATCH = `@@ -1,6 +1,24 @@
 import { db } from '../db.js';
 import type { FastifyInstance } from 'fastify';

+export async function getOrder(orderId: string, user: { id: string } | null) {
+  if (!user) {
+    throw new UnauthorizedError('authentication required');
+  }
+  const order = await db.orders.findById(orderId);
+  if (!order) {
+    throw new NotFoundError('order not found');
+  }
+  if (order.customerId !== user.id) {
+    throw new ForbiddenError('order belongs to another customer');
+  }
+  return order;
+}
+
 export function registerOrderRoutes(app: FastifyInstance) {
   app.get('/orders', listOrders);
+  app.get('/orders/:id', async (req, reply) => {
+    const order = await getOrder(req.params.id, req.user ?? null);
+    return reply.send(order);
+  });
 }`;

/** #483 — the whole new test file: one happy-path case, no error branch, no edges. */
const PR483_TEST_PATCH = `@@ -0,0 +1,12 @@
+import { describe, it, expect, vi } from 'vitest';
+import { getOrder } from '../src/api/orders.js';
+
+describe('getOrder', () => {
+  it('returns the order for its owner', async () => {
+    vi.spyOn(db.orders, 'findById').mockResolvedValue({ id: 'o_1', customerId: 'u_1' });
+
+    const order = await getOrder('o_1', { id: 'u_1' });
+
+    expect(order.id).toBe('o_1');
+  });
+});`;

/** #484 — required `?tenant=`, a new arg on an exported fn, a renamed response field. */
const PR484_ORDERS_PATCH = `@@ -4,13 +4,13 @@
-export async function getOrder(orderId: string, user: { id: string } | null) {
+export async function getOrder(orderId: string, user: { id: string } | null, tenantId: string) {
   if (!user) {
     throw new UnauthorizedError('authentication required');
   }
-  const order = await db.orders.findById(orderId);
+  const order = await db.orders.findByIdForTenant(orderId, tenantId);
   if (!order) {
     throw new NotFoundError('order not found');
   }
   if (order.customerId !== user.id) {
     throw new ForbiddenError('order belongs to another customer');
   }
-  return order;
+  return { ...order, customer_id: order.customerId, customerId: undefined };
 }
@@ -20,5 +20,9 @@
   app.get('/orders/:id', async (req, reply) => {
-    const order = await getOrder(req.params.id, req.user ?? null);
+    const tenant = req.query.tenant;
+    if (!tenant) {
+      return reply.status(400).send({ error: 'tenant query param is required' });
+    }
+    const order = await getOrder(req.params.id, req.user ?? null, tenant);
     return reply.send(order);
   });
 }`;

/** #484 — the suite is updated to the new shape, so it stays green either way. */
const PR484_TEST_PATCH = `@@ -5,6 +5,6 @@
   it('returns the order for its owner', async () => {
-    vi.spyOn(db.orders, 'findById').mockResolvedValue({ id: 'o_1', customerId: 'u_1' });
+    vi.spyOn(db.orders, 'findByIdForTenant').mockResolvedValue({ id: 'o_1', customerId: 'u_1' });

-    const order = await getOrder('o_1', { id: 'u_1' });
+    const order = await getOrder('o_1', { id: 'u_1' }, 't_acme');

     expect(order.id).toBe('o_1');`;

/**
 * Seed the starter's demo data. Idempotent: re-running upserts the default
 * workspace/user and the demo fixtures.
 *
 * Seeds: default workspace + system user + membership, default settings,
 * demo repo (acme/payments-api), PRs #482–#484 with files/commits, a sample
 * review with a few findings, the four built-in agents (General + Security +
 * Performance + Test Quality) on the default openrouter/deepseek-v4-flash
 * provider+model, the five built-in skills, and the agent⇄skill links that make
 * the skills-on/skills-off control experiment reproducible.
 *
 * Course lessons populate the other tables (conventions, memory, eval, …) once
 * their features are built — they start empty here.
 */

export const DEFAULT_WORKSPACE_NAME = 'default';
export const SYSTEM_USER_EMAIL = 'you@local';

export async function seed(db: Db): Promise<{ workspaceId: string; userId: string }> {
  // ---- workspace + user (no-auth defaults) ----
  let [ws] = await db
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.name, DEFAULT_WORKSPACE_NAME));
  if (!ws) {
    [ws] = await db
      .insert(t.workspaces)
      .values({ name: DEFAULT_WORKSPACE_NAME })
      .returning();
  }
  const workspaceId = ws!.id;

  let [user] = await db.select().from(t.users).where(eq(t.users.email, SYSTEM_USER_EMAIL));
  if (!user) {
    [user] = await db
      .insert(t.users)
      .values({ email: SYSTEM_USER_EMAIL, name: 'You' })
      .returning();
  }
  const userId = user!.id;

  await db
    .insert(t.workspaceMembers)
    .values({ workspaceId, userId, role: 'owner' })
    .onConflictDoNothing();

  // ---- default settings ----
  const defaultSettings: Record<string, unknown> = {
    polling_interval_min: 5,
    theme: 'dark',
    density: 'regular',
    sync_to_folder: true,
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoNothing();
  }

  // ---- demo repo (acme/payments-api) ----
  let [repo] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
  if (!repo) {
    [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'payments-api',
        fullName: 'acme/payments-api',
        defaultBranch: 'main',
        clonePath: null,
        createdBy: userId,
      })
      .returning();
  }
  const repoId = repo!.id;

  // ---- PR #482 (rate limiting) ----
  let [pr] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 482)));
  if (!pr) {
    [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 482,
        title: 'Add rate limiting to public API endpoints',
        author: 'marisa.koch',
        branch: 'feat/rate-limit-public',
        base: 'main',
        headSha: 'a1b2c3d4e5f6',
        additions: 247,
        deletions: 38,
        filesCount: 9,
        status: 'needs_review',
        body: 'Add rate limiting to public API endpoints to prevent abuse from unauthenticated clients.',
      })
      .returning();

    // pr_files (subset)
    await db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'src/middleware/ratelimit.ts', additions: 84, deletions: 0 },
      { prId: pr!.id, path: 'src/api/public/webhooks.ts', additions: 31, deletions: 6 },
      { prId: pr!.id, path: 'src/config.ts', additions: 4, deletions: 0 },
      { prId: pr!.id, path: 'src/api/users.ts', additions: 7, deletions: 2 },
    ]);

    // pr_commits
    await db.insert(t.prCommits).values({
      prId: pr!.id,
      sha: 'a1b2c3d4e5f6',
      message: 'Add token-bucket rate limiter',
      author: 'marisa.koch',
    });

    // a sample review + findings so the PR shows results before the first run
    const [review] = await db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary:
          'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.',
        score: 61,
        model: 'seed',
      })
      .returning();

    await db.insert(t.findings).values([
      {
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: 12,
        endLine: 12,
        severity: 'CRITICAL',
        category: 'security',
        title: 'Hardcoded Stripe secret key in commit',
        rationale: 'Line 12 contains a literal `sk_live_` Stripe secret key.',
        suggestion: 'Move to env var and rotate the key immediately.',
        confidence: 0.98,
      },
      {
        reviewId: review!.id,
        file: 'src/api/users.ts',
        startLine: 45,
        endLine: 52,
        severity: 'WARNING',
        category: 'perf',
        title: 'N+1 query in user list endpoint',
        rationale: 'Loop issues one query per user → N+1.',
        suggestion: 'Use a single IN query and group in memory.',
        confidence: 0.86,
      },
    ]);
  }

  // ---- PRs #483 / #484 — the skills control experiment -------------------
  // Unlike #482 these carry REAL patches, so `diffFromPrFiles` reconstructs a
  // parseable unified diff and findings can actually ground against it. Each PR
  // is written so an agent WITHOUT the relevant skill plausibly approves it and
  // the same agent WITH the skill has something concrete to flag:
  //   #483 → Test Quality Reviewer: 3 new throw branches, 1 happy-path test.
  //   #484 → General Reviewer + api-contract-gate: a required query param and a
  //          renamed response field on an existing route, tests updated to match
  //          so the suite stays green and only the CONTRACT break remains.
  const demoPulls: Array<{
    pr: Omit<typeof t.pullRequests.$inferInsert, 'workspaceId' | 'repoId'>;
    files: Array<Omit<typeof t.prFiles.$inferInsert, 'prId'>>;
    commits: Array<Omit<typeof t.prCommits.$inferInsert, 'prId'>>;
  }> = [
    {
      pr: {
        number: 483,
        title: 'Add order lookup endpoint',
        author: 'devon.park',
        branch: 'feat/order-lookup',
        base: 'main',
        headSha: 'b7c1d90a4e21',
        additions: 30,
        deletions: 0,
        filesCount: 2,
        status: 'needs_review',
        body: 'Adds GET /orders/:id plus a getOrder helper that resolves the order for the calling user. Covered by a new unit test.',
      },
      files: [
        { path: 'src/api/orders.ts', additions: 18, deletions: 0, patch: PR483_ORDERS_PATCH },
        { path: 'test/orders.test.ts', additions: 12, deletions: 0, patch: PR483_TEST_PATCH },
      ],
      commits: [
        {
          sha: 'b7c1d90a4e21',
          message: 'Add getOrder + GET /orders/:id with a happy-path test',
          author: 'devon.park',
        },
      ],
    },
    {
      pr: {
        number: 484,
        title: 'Tighten order lookup filtering',
        author: 'devon.park',
        branch: 'feat/order-lookup-tenant',
        base: 'main',
        headSha: 'c3f8a1b62d47',
        additions: 10,
        deletions: 6,
        filesCount: 2,
        status: 'needs_review',
        body: 'Scopes order lookup to a tenant. GET /orders/:id now takes ?tenant= and the response uses customer_id. Existing tests updated.',
      },
      files: [
        { path: 'src/api/orders.ts', additions: 8, deletions: 4, patch: PR484_ORDERS_PATCH },
        { path: 'test/orders.test.ts', additions: 2, deletions: 2, patch: PR484_TEST_PATCH },
      ],
      commits: [
        {
          sha: 'c3f8a1b62d47',
          message: 'Require ?tenant= on order lookup and rename customerId → customer_id',
          author: 'devon.park',
        },
      ],
    },
  ];

  for (const demo of demoPulls) {
    const [existingPr] = await db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, demo.pr.number)));
    if (existingPr) continue;
    const [row] = await db
      .insert(t.pullRequests)
      .values({ ...demo.pr, workspaceId, repoId })
      .returning();
    await db.insert(t.prFiles).values(demo.files.map((f) => ({ ...f, prId: row!.id })));
    await db.insert(t.prCommits).values(demo.commits.map((c) => ({ ...c, prId: row!.id })));
  }

  // ---- built-in agents (the starter presets) ----
  // Prompt bodies live in ./seed-prompts.ts (mirrored in docs/agent-prompts/*.md).
  const seedAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'General Reviewer',
      description: 'Reviews a PR diff for bugs, correctness, and clarity.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: GENERAL_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Security Reviewer',
      description: 'Flags secrets, injection, SSRF and the lethal trifecta before merge.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: SECURITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Performance Reviewer',
      description: 'Catches N+1 queries, missing indexes, and hot-path allocations.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: PERFORMANCE_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Test Quality Reviewer',
      description:
        'Reviews test quality: uncovered branches, missed corner cases, over-mocking, and flakiness.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: TEST_QUALITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];
  for (const a of seedAgents) {
    const [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (!existing) await db.insert(t.agents).values(a);
  }

  // ---- built-in skills (bodies in ./seed-skills.ts) ------------------------
  // Skill rows are workspace-scoped and keyed for the seed by (workspace, name),
  // same select-then-insert shape as the agents above.
  const skillIdByName = new Map<string, string>();
  for (const s of SEED_SKILLS) {
    let [row] = await db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, s.name)));
    if (!row) {
      [row] = await db
        .insert(t.skills)
        .values({
          workspaceId,
          name: s.name,
          description: s.description,
          type: s.type,
          source: s.source,
          body: s.body,
          enabled: true,
          version: 1,
        })
        .returning();
      // The v1 body snapshot, which `SkillsRepository.insert` would normally
      // write. Seeding the row directly skips that, and without it the Versions
      // tab shows nothing until the first edit and "restore v1" is impossible —
      // the original body would exist only on `skills.body`, which the next edit
      // overwrites.
      await db
        .insert(t.skillVersions)
        .values({ skillId: row!.id, version: 1, body: s.body })
        .onConflictDoNothing();
    }
    skillIdByName.set(s.name, row!.id);
  }

  // ---- agent ⇄ skill links -------------------------------------------------
  // `order` is the block order inside the prompt's `## Skills / rules` section
  // (run-executor preserves it), so it is explicit here rather than incidental.
  const skillLinks: Array<{ agent: string; skills: string[] }> = [
    {
      agent: 'Test Quality Reviewer',
      skills: [
        'branch-coverage-gate',
        'edge-case-checklist',
        'over-mocking-guard',
        'flaky-test-smells',
      ],
    },
    { agent: 'General Reviewer', skills: ['api-contract-gate'] },
  ];
  for (const link of skillLinks) {
    const [agentRow] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, link.agent)));
    if (!agentRow) continue;
    for (const [order, skillName] of link.skills.entries()) {
      const skillId = skillIdByName.get(skillName);
      if (!skillId) continue;
      await db
        .insert(t.agentSkills)
        .values({ agentId: agentRow.id, skillId, order })
        // Composite PK (agent_id, skill_id): a re-run must not duplicate or
        // silently re-shuffle an order the user has since changed in the editor.
        .onConflictDoNothing();
    }
  }

  // ---- L02 — seeded conventions (read-only e2e coverage; extraction itself
  // is an LLM call and is not exercised by the deterministic e2e suite) ------
  const [existingConvention] = await db
    .select()
    .from(t.conventions)
    .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
  if (!existingConvention) {
    await db.insert(t.conventions).values([
      {
        workspaceId,
        repoId,
        rule: 'Always put rate-limiter middleware under src/middleware/, one file per concern.',
        category: 'structure',
        evidencePath: 'src/middleware/ratelimit.ts',
        evidenceSnippet: "export function rateLimit(opts: RateLimitOptions) {",
        evidenceLine: 1,
        confidence: 0.92,
        supportCount: 3,
        status: 'accepted',
        accepted: true,
      },
      {
        workspaceId,
        repoId,
        rule: 'Always validate the request body with Zod before a public API handler touches it.',
        category: 'api',
        evidencePath: 'src/api/public/webhooks.ts',
        evidenceSnippet: 'const body = WebhookPayload.parse(req.body);',
        evidenceLine: 14,
        confidence: 0.81,
        supportCount: 2,
        status: 'pending',
        accepted: false,
      },
      {
        workspaceId,
        repoId,
        rule: 'Never read `process.env` directly — always go through the typed `config` object.',
        category: 'structure',
        evidencePath: 'src/config.ts',
        evidenceSnippet: 'export const config = { port: 3000, ... };',
        evidenceLine: 8,
        confidence: 0.6,
        supportCount: 1,
        status: 'rejected',
        accepted: false,
      },
    ]);
  }

  return { workspaceId, userId };
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const handle = createDb(url);
  seed(handle.db)
    .then(async (r) => {
      console.log('✓ seeded', r);
      await handle.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('✗ seed failed:', err);
      await handle.close();
      process.exit(1);
    });
}
