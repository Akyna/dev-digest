import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

/**
 * L02 — conventions module end to end over a real Postgres: extract (with one
 * candidate deliberately ungrounded, to prove verify.ts drops it before it
 * reaches the DB), accept, skill-draft preview, and skill creation — including
 * the hand-off to `skills.source = 'extracted'` + an `agent_skills` link.
 */
d('/repos/:id/conventions', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function setupRepo() {
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'conv-repo',
        fullName: `acme/conv-repo-${Date.now()}`,
        clonePath: '/mock/clones/acme/conv-repo',
      })
      .returning();
    return repo!.id as string;
  }

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient({
          files: {
            'package.json': '{"name":"conv-repo"}',
            'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }, null, 2),
          },
        }),
        github: new MockGitHubClient(),
        llm: {
          // The service's default feature model (no workspace override set) is
          // 'openrouter' (see conventions/constants.ts) — mock that one, not
          // 'openai', or this test hits the real OpenRouter API.
          openrouter: new MockLLMProvider('openrouter', {
            structuredBySchema: {
              ConventionFileSelection: { paths: ['package.json', 'tsconfig.json'] },
              ConventionExtraction: {
                candidates: [
                  {
                    category: 'naming',
                    rule: 'Package name matches the repo folder.',
                    evidence_path: 'package.json',
                    evidence_line: 1,
                    evidence_snippet: '{"name":"conv-repo"}',
                    confidence: 0.9,
                  },
                  {
                    category: 'bogus',
                    rule: 'A rule the model hallucinated evidence for.',
                    evidence_path: 'src/does-not-exist.ts',
                    evidence_line: 5,
                    evidence_snippet: 'this file was never sampled',
                    confidence: 0.9,
                  },
                ],
              },
            },
          }),
        },
      },
    });
  }

  it('extract drops the ungrounded candidate and persists the verified ones', async () => {
    const app = await makeApp();
    const repoId = await setupRepo();

    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.stats.dropped).toBeGreaterThanOrEqual(1);
    expect(body.candidates.every((c: { evidence_path: string }) => c.evidence_path !== 'src/does-not-exist.ts')).toBe(
      true,
    );
    // deterministic tsconfig strict-mode signal + the grounded LLM candidate
    expect(body.candidates.length).toBeGreaterThanOrEqual(2);
    expect(body.candidates.every((c: { status: string }) => c.status === 'pending')).toBe(true);

    const list = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(list.statusCode).toBe(200);
    expect(list.json().candidates.length).toBe(body.candidates.length);
    expect(list.json().last_scan_at).not.toBeNull();
    await app.close();
  });

  it('PATCH accepts a convention, then it survives a re-scan', async () => {
    const app = await makeApp();
    const repoId = await setupRepo();
    await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });

    const before = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    const target = before.candidates[0];

    const patched = await app.inject({
      method: 'PATCH',
      url: `/conventions/${target.id}`,
      payload: { status: 'accepted' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().status).toBe('accepted');
    expect(patched.json().accepted).toBe(true);

    // re-scan: pending rows are replaced, the accepted one is not
    await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    const after = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    expect(after.candidates.map((c: { id: string }) => c.id)).toContain(target.id);
    await app.close();
  });

  it('skill-draft previews a body, and skill creation persists source=extracted + an agent link', async () => {
    const app = await makeApp();
    const repoId = await setupRepo();
    await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });

    const listed = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    const ids = listed.candidates.map((c: { id: string }) => c.id);
    for (const id of ids) {
      await app.inject({ method: 'PATCH', url: `/conventions/${id}`, payload: { status: 'accepted' } });
    }

    const draft = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill-draft`,
      payload: { convention_ids: ids },
    });
    expect(draft.statusCode).toBe(200);
    expect(draft.json().body).toContain('conv-repo-conventions');

    const agentRes = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: {
        name: 'Conventions Test Agent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        system_prompt: 'Review PRs.',
      },
    });
    const agentId = agentRes.json().id as string;

    const created = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: {
        convention_ids: ids,
        name: 'Conv Repo Conventions',
        type: 'convention',
        body: draft.json().body,
        agent_ids: [agentId],
      },
    });
    expect(created.statusCode).toBe(201);
    const skillId = created.json().id as string;

    const [skillRow] = await pg.handle.db.select().from(t.skills).where(eq(t.skills.id, skillId));
    expect(skillRow?.source).toBe('extracted');
    expect(skillRow?.evidenceFiles?.length).toBeGreaterThan(0);

    const links = await pg.handle.db.select().from(t.agentSkills).where(eq(t.agentSkills.skillId, skillId));
    expect(links.map((l) => l.agentId)).toContain(agentId);
    await app.close();
  });
});
