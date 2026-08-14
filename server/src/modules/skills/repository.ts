import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SkillSource, SkillType } from '@devdigest/shared';
import {
  DEFAULT_SKILL_DESCRIPTION,
  DEFAULT_SKILL_SOURCE,
  INITIAL_SKILL_VERSION,
} from './constants.js';
import { isContentChange } from './helpers.js';

/**
 * A1 — skills data-access. Owns every WRITE to `skills` and all of
 * `skill_versions`. Not the only reader: `AgentsRepository.linkedSkills` joins
 * `skills` through `agent_skills` (the agents module's own link table), which is
 * cheaper than a cross-module round trip per skill. Workspace-scoped throughout:
 * a skill is only ever reachable through the workspace that owns it.
 *
 * `skill_versions` stores the body and nothing else — the body IS the skill, so
 * a body snapshot is the whole history we need for diff/restore.
 */

export type SkillRow = typeof t.skills.$inferSelect;
export type SkillVersionRow = typeof t.skillVersions.$inferSelect;

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description?: string;
  type: SkillType;
  source?: SkillSource;
  body: string;
  enabled?: boolean;
  evidenceFiles?: string[] | null;
}

export interface UpdateSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
  evidenceFiles?: string[] | null;
}

export class SkillsRepository {
  constructor(private db: Db) {}

  /** Ordered by name, and the ORDER BY is load-bearing: without it Postgres
      returns heap order, and because an UPDATE rewrites the row at the end of
      the heap, saving a skill made its card jump to the bottom of the list. */
  async list(workspaceId: string): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** Delete a skill (scoped to workspace). Versions and agent links cascade.
   *  Returns false if no such skill existed in the workspace. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  /**
   * Insert a skill AND record version 1 in skill_versions (immutable snapshot).
   *
   * Transactional: v1 is the one snapshot that can never be reconstructed, so a
   * skill row that committed without it would be permanently unrestorable.
   */
  async insert(values: InsertSkill): Promise<SkillRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.skills)
        .values({
          workspaceId: values.workspaceId,
          name: values.name,
          description: values.description ?? DEFAULT_SKILL_DESCRIPTION,
          type: values.type,
          source: values.source ?? DEFAULT_SKILL_SOURCE,
          body: values.body,
          enabled: values.enabled ?? true,
          version: INITIAL_SKILL_VERSION,
          evidenceFiles: values.evidenceFiles ?? null,
        })
        .returning();
      await this.snapshotVersion(row!, INITIAL_SKILL_VERSION, tx);
      return row!;
    });
  }

  /**
   * Update a skill. Any content change (anything except just toggling `enabled`)
   * bumps the version and snapshots the new body into skill_versions, so an edit
   * is always recoverable. Enable/disable is a runtime flag and leaves history
   * untouched.
   *
   * Transactional: the version bump and its snapshot must land together, or
   * `skills.version` points at a `skill_versions` row that does not exist and
   * restoring that version 404s forever with nothing to backfill it from.
   */
  async update(workspaceId: string, id: string, patch: UpdateSkill): Promise<SkillRow | undefined> {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return undefined;

    const contentChanged = isContentChange(patch);
    const nextVersion = contentChanged ? existing.version + 1 : existing.version;

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(t.skills)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.body !== undefined ? { body: patch.body } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.evidenceFiles !== undefined ? { evidenceFiles: patch.evidenceFiles } : {}),
          ...(contentChanged ? { version: nextVersion } : {}),
        })
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .returning();

      if (contentChanged && row) await this.snapshotVersion(row, nextVersion, tx);
      return row;
    });
  }

  /** `tx` defaults to the pool so callers outside a transaction still work. */
  private async snapshotVersion(row: SkillRow, version: number, tx: Db = this.db): Promise<void> {
    await tx
      .insert(t.skillVersions)
      .values({ skillId: row.id, version, body: row.body })
      .onConflictDoNothing();
  }

  // ---- skill_versions (immutable body snapshots) ---------------------------

  /** All body snapshots for a skill, newest version first. */
  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  /** A single body snapshot, or undefined if that version was never recorded. */
  async getVersion(skillId: string, version: number): Promise<SkillVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row;
  }

  // ---- stats -----------------------------------------------------------------

  /** Agents that have this skill linked, for the skill's Stats tab. Cross-module
      read symmetric to `AgentsRepository.linkedSkills` — the agents module reads
      through `agent_skills` into `skills`, this reads through it the other way.
      Not workspace-filtered: the caller already confirmed the skill is in this
      workspace via `getById`, and a link can only ever point at an agent in the
      same workspace as the skill (the agents module validates that on write). */
  async linkedAgents(skillId: string): Promise<Array<{ id: string; name: string }>> {
    return this.db
      .select({ id: t.agents.id, name: t.agents.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agents.id, t.agentSkills.agentId))
      .where(eq(t.agentSkills.skillId, skillId))
      .orderBy(asc(t.agents.name));
  }
}
