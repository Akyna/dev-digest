import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { strToU8, zipSync } from 'fflate';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * A1 — the skills module end to end over a real Postgres: CRUD, the body
 * version history in `skill_versions` (edits bump, enable/disable does not),
 * restore-as-a-new-version, the read-only import preview, and the hand-off to
 * the agents module's existing skill-link endpoints.
 */
d('/skills', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  const createBody = {
    name: 'no-console-log',
    description: 'Flag stray console.log calls.',
    type: 'convention' as const,
    body: '# no-console-log\n\nStray console.log in shipped code is a finding.\n',
  };

  it('create → list → get', async () => {
    const app = await makeApp();

    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    expect(created.statusCode).toBe(201);
    const skill = created.json();
    expect(skill).toMatchObject({
      name: 'no-console-log',
      description: 'Flag stray console.log calls.',
      type: 'convention',
      source: 'manual',
      enabled: true,
      version: 1,
    });

    const list = await app.inject({ method: 'GET', url: '/skills' });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((s: { id: string }) => s.id)).toContain(skill.id);

    const one = await app.inject({ method: 'GET', url: `/skills/${skill.id}` });
    expect(one.statusCode).toBe(200);
    expect(one.json().body).toBe(createBody.body);

    const ghost = '00000000-0000-0000-0000-000000000000';
    expect((await app.inject({ method: 'GET', url: `/skills/${ghost}` })).statusCode).toBe(404);
    await app.close();
  });

  it('editing the body bumps the version and appends a skill_versions row', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: createBody })).json()
      .id as string;

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${id}`,
      payload: { body: '# no-console-log\n\nv2 body.\n' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().version).toBe(2);

    // Read the table directly: the snapshot must actually be persisted.
    const rows = await pg.handle.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, id));
    expect(rows.map((r) => r.version).sort()).toEqual([1, 2]);

    const versions = (await app.inject({ method: 'GET', url: `/skills/${id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0].body).toBe('# no-console-log\n\nv2 body.\n');
    expect(versions[1].body).toBe(createBody.body);

    const v1 = await app.inject({ method: 'GET', url: `/skills/${id}/versions/1` });
    expect(v1.statusCode).toBe(200);
    expect(v1.json()).toMatchObject({ skill_id: id, version: 1, body: createBody.body });
    await app.close();
  });

  it('toggling enabled alone does NOT bump the version', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: createBody })).json()
      .id as string;

    const toggled = await app.inject({
      method: 'PUT',
      url: `/skills/${id}`,
      payload: { enabled: false },
    });
    expect(toggled.statusCode).toBe(200);
    expect(toggled.json()).toMatchObject({ enabled: false, version: 1 });

    const versions = (await app.inject({ method: 'GET', url: `/skills/${id}/versions` })).json();
    expect(versions).toHaveLength(1);
    await app.close();
  });

  it('restoring v1 creates v3 with v1 body (history is append-only)', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: createBody })).json()
      .id as string;
    await app.inject({
      method: 'PUT',
      url: `/skills/${id}`,
      payload: { body: '# rewritten\n' },
    });

    const restored = await app.inject({ method: 'POST', url: `/skills/${id}/restore/1` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ version: 3, body: createBody.body });

    const versions = (await app.inject({ method: 'GET', url: `/skills/${id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);
    expect(versions[0].body).toBe(versions[2].body);

    // Unknown version → 404, non-numeric → 422 at the edge.
    expect(
      (await app.inject({ method: 'POST', url: `/skills/${id}/restore/99` })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: `/skills/${id}/versions/abc` })).statusCode,
    ).toBe(422);
    await app.close();
  });

  it('DELETE removes the skill', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: createBody })).json()
      .id as string;

    const del = await app.inject({ method: 'DELETE', url: `/skills/${id}` });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ ok: true });
    expect((await app.inject({ method: 'GET', url: `/skills/${id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/skills/${id}` })).statusCode).toBe(404);
    await app.close();
  });

  it('POST /skills/import/preview parses a .md and persists nothing', async () => {
    const app = await makeApp();
    const before = (await app.inject({ method: 'GET', url: '/skills' })).json();

    const md = [
      '---',
      'name: imported-rubric',
      'description: Scoring criteria for a review, folded across',
      '  two source lines.',
      '---',
      '',
      '# Imported Rubric',
      '',
      'Body prose.',
    ].join('\n');

    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'imported-rubric.md', content: md },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      name: 'imported-rubric',
      description: 'Scoring criteria for a review, folded across two source lines.',
      type: 'rubric',
      body: '# Imported Rubric\n\nBody prose.',
      ignored_files: [],
      warnings: [],
    });

    const after = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(after).toEqual(before);
    await app.close();
  });

  it('POST /skills/import/preview reads a .zip and refuses to touch its executables', async () => {
    const app = await makeApp();
    const before = (await app.inject({ method: 'GET', url: '/skills' })).json();

    const archive = zipSync({
      'skill/SKILL.md': strToU8('---\nname: zipped\ndescription: From an archive.\n---\n\n# Zipped\n'),
      'skill/install.sh': strToU8('#!/bin/sh\necho pwned\n'),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'zipped.zip', content_b64: Buffer.from(archive).toString('base64') },
    });
    expect(res.statusCode).toBe(200);
    const preview = res.json();
    expect(preview.name).toBe('zipped');
    expect(preview.description).toBe('From an archive.');
    expect(preview.body.trim()).toBe('# Zipped');
    expect(preview.ignored_files).toEqual(['skill/install.sh']);
    expect(preview.warnings.join(' ')).toContain('install.sh');

    expect((await app.inject({ method: 'GET', url: '/skills' })).json()).toEqual(before);
    await app.close();
  });

  it('import rejects both / neither payloads and unknown extensions', async () => {
    const app = await makeApp();

    const both = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'a.md', content: 'x', content_b64: 'eA==' },
    });
    expect(both.statusCode).toBe(422);

    const neither = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'a.md' },
    });
    expect(neither.statusCode).toBe(422);

    const wrongExt = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'a.tar.gz', content: '# x' },
    });
    expect(wrongExt.statusCode).toBe(422);

    // Extension and payload must agree: .zip cannot arrive as raw text.
    const mismatch = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'a.zip', content: '# x' },
    });
    expect(mismatch.statusCode).toBe(422);
    await app.close();
  });

  it('a skill links to a seeded agent through the agents module', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const agents = (await app.inject({ method: 'GET', url: '/agents' })).json();
    const agentId = agents[0].id as string;

    const linked = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: skillId },
    });
    expect(linked.statusCode).toBe(200);

    const links = (await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json();
    expect(links.map((l: { skill_id: string }) => l.skill_id)).toContain(skillId);

    // And the link row really exists (agent_skills is the agents module's table).
    const rows = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(and(eq(t.agentSkills.agentId, agentId), eq(t.agentSkills.skillId, skillId)));
    expect(rows).toHaveLength(1);
    await app.close();
  });

  it('seeded skills carry their v1 body snapshot, so restore works before any edit', async () => {
    const app = await makeApp();
    const skills = (await app.inject({ method: 'GET', url: '/skills' })).json() as Array<{
      id: string;
      name: string;
      body: string;
      version: number;
    }>;
    const seeded = skills.find((s) => s.name === 'branch-coverage-gate')!;
    expect(seeded.version).toBe(1);

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${seeded.id}/versions` })
    ).json() as Array<{ version: number; body: string }>;
    expect(versions.map((v) => v.version)).toEqual([1]);
    expect(versions[0]!.body).toBe(seeded.body);
    await app.close();
  });

  it('GET /skills keeps a stable name order across edits', async () => {
    const app = await makeApp();
    const names = () =>
      app
        .inject({ method: 'GET', url: '/skills' })
        .then((r) => (r.json() as Array<{ name: string }>).map((s) => s.name));

    const before = await names();
    expect(before).toEqual([...before].sort());

    // Editing a row must not move it: Postgres rewrites an updated row at the
    // end of the heap, so without an ORDER BY the card jumped down the list.
    const first = (await app.inject({ method: 'GET', url: '/skills' })).json()[0] as {
      id: string;
      body: string;
    };
    await app.inject({
      method: 'PUT',
      url: `/skills/${first.id}`,
      payload: { body: `${first.body}\n\n- edited` },
    });
    expect(await names()).toEqual(before);
    await app.close();
  });

  it('GET /agents/skill-counts answers the whole list in one grouped query', async () => {
    const app = await makeApp();
    // The seed links 4 skills to Test Quality Reviewer and 1 to General Reviewer.
    const agents = (await app.inject({ method: 'GET', url: '/agents' })).json();
    const byName = new Map(agents.map((a: { id: string; name: string }) => [a.name, a.id]));

    const res = await app.inject({ method: 'GET', url: '/agents/skill-counts' });
    expect(res.statusCode).toBe(200);
    const counts = res.json() as Record<string, number>;

    expect(counts[byName.get('Test Quality Reviewer') as string]).toBe(4);

    // The bulk count must agree with the per-agent endpoint for EVERY agent —
    // asserted against `/agents/:id/skills` rather than a literal, because an
    // earlier test in this file links a skill to the first seeded agent.
    for (const agent of agents as Array<{ id: string; name: string }>) {
      const links = (
        await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })
      ).json() as unknown[];
      // An agent with no links is absent rather than 0 — the client defaults it.
      expect(counts[agent.id] ?? 0).toBe(links.length);
    }
    expect(counts[byName.get('Performance Reviewer') as string]).toBeUndefined();

    // The static segment must not be swallowed by the `/agents/:id` route.
    expect(Array.isArray(counts)).toBe(false);
    await app.close();
  });

  it('setting skills survives a duplicate / unknown / foreign id without wiping the links', async () => {
    const app = await makeApp();
    const { db } = pg.handle;
    const agents = (await app.inject({ method: 'GET', url: '/agents' })).json();
    const agent = (agents as Array<{ id: string; name: string }>).find(
      (a) => a.name === 'Test Quality Reviewer',
    )!;
    const before = (
      await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })
    ).json() as Array<{ skill_id: string }>;
    expect(before.length).toBe(4);

    // A skill in ANOTHER workspace must never be linkable into this agent.
    const [otherWs] = await db.insert(t.workspaces).values({ name: 'other-links' }).returning();
    const [foreign] = await db
      .insert(t.skills)
      .values({
        workspaceId: otherWs!.id,
        name: 'foreign-skill',
        description: '',
        type: 'custom',
        source: 'manual',
        body: 'not yours',
      })
      .returning();

    const first = before[0]!.skill_id;
    const second = before[1]!.skill_id;
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: {
        // duplicate → composite-PK violation; random uuid → FK violation;
        // foreign → cross-workspace leak. All three used to land AFTER the
        // DELETE had already committed, leaving the agent with zero skills.
        skill_ids: [first, first, second, '00000000-0000-4000-8000-000000000000', foreign!.id],
      },
    });
    expect(res.statusCode).toBe(200);

    const after = res.json() as Array<{ skill_id: string; order: number }>;
    expect(after.map((l) => l.skill_id)).toEqual([first, second]);
    expect(after.map((l) => l.order)).toEqual([0, 1]);
    await app.close();
  });

  it('GET /skills/:id/stats reports version count and linked agents', async () => {
    const app = await makeApp();
    const created = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json() as { id: string };

    const fresh = await app.inject({ method: 'GET', url: `/skills/${created.id}/stats` });
    expect(fresh.statusCode).toBe(200);
    expect(fresh.json()).toEqual({
      skill_id: created.id,
      versions: 1,
      agents_linked: 0,
      agents: [],
    });

    // A content edit bumps the version count too — `skill.version` IS the
    // version count, so this also locks in that the stats endpoint doesn't
    // drift from `skill_versions`.
    await app.inject({
      method: 'PUT',
      url: `/skills/${created.id}`,
      payload: { body: '# no-console-log\n\nv2 body.\n' },
    });

    const agents = (await app.inject({ method: 'GET', url: '/agents' })).json() as Array<{
      id: string;
      name: string;
    }>;
    const a = agents.find((x) => x.name === 'Test Quality Reviewer')!;
    const b = agents.find((x) => x.name === 'General Reviewer')!;
    await app.inject({
      method: 'POST',
      url: `/agents/${a.id}/skills`,
      payload: { skill_id: created.id },
    });
    await app.inject({
      method: 'POST',
      url: `/agents/${b.id}/skills`,
      payload: { skill_id: created.id },
    });

    const after = await app.inject({ method: 'GET', url: `/skills/${created.id}/stats` });
    expect(after.statusCode).toBe(200);
    const stats = after.json();
    expect(stats.versions).toBe(2);
    expect(stats.agents_linked).toBe(2);
    expect(stats.agents.map((x: { name: string }) => x.name)).toEqual(
      ['General Reviewer', 'Test Quality Reviewer'].sort(),
    );

    const ghost = '00000000-0000-0000-0000-000000000000';
    expect((await app.inject({ method: 'GET', url: `/skills/${ghost}/stats` })).statusCode).toBe(
      404,
    );
    await app.close();
  });

  it('skills are workspace-scoped', async () => {
    const app = await makeApp();
    const { db } = pg.handle;
    const [otherWs] = await db.insert(t.workspaces).values({ name: 'other-skills' }).returning();
    const [foreign] = await db
      .insert(t.skills)
      .values({
        workspaceId: otherWs!.id,
        name: 'foreign',
        description: '',
        type: 'custom',
        source: 'manual',
        body: '# foreign',
      })
      .returning();

    expect((await app.inject({ method: 'GET', url: `/skills/${foreign!.id}` })).statusCode).toBe(
      404,
    );
    expect(
      (await app.inject({ method: 'GET', url: `/skills/${foreign!.id}/versions` })).statusCode,
    ).toBe(404);
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(list.map((s: { id: string }) => s.id)).not.toContain(foreign!.id);
    await app.close();
  });
});
