import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export type ConventionRow = typeof t.conventions.$inferSelect;

export interface InsertConvention {
  workspaceId: string;
  repoId: string;
  rule: string;
  category?: string | null;
  evidencePath?: string | null;
  evidenceSnippet?: string | null;
  evidenceLine?: number | null;
  evidenceEndLine?: number | null;
  confidence?: number | null;
  supportCount?: number;
}

export interface UpdateConvention {
  rule?: string;
  category?: string | null;
  evidenceSnippet?: string | null;
  status?: 'pending' | 'accepted' | 'rejected';
  edited?: boolean;
}

/**
 * L02 — conventions data-access. The only place that touches `conventions`.
 * Every query is scoped by `workspaceId`; list/rescan are further scoped by
 * `repoId` since conventions belong to one clone.
 */
export class ConventionsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
  }

  async getById(workspaceId: string, id: string): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)));
    return row;
  }

  async getByIds(workspaceId: string, ids: string[]): Promise<ConventionRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), inArray(t.conventions.id, ids)));
  }

  async insertMany(rows: InsertConvention[]): Promise<ConventionRow[]> {
    if (rows.length === 0) return [];
    return this.db
      .insert(t.conventions)
      .values(
        rows.map((r) => ({
          workspaceId: r.workspaceId,
          repoId: r.repoId,
          rule: r.rule,
          category: r.category ?? null,
          evidencePath: r.evidencePath ?? null,
          evidenceSnippet: r.evidenceSnippet ?? null,
          evidenceLine: r.evidenceLine ?? null,
          evidenceEndLine: r.evidenceEndLine ?? null,
          confidence: r.confidence ?? null,
          supportCount: r.supportCount ?? 1,
        })),
      )
      .returning();
  }

  /**
   * Re-scan replace: only `pending` rows for this repo are deleted before the
   * new candidates are inserted. Rows the user has judged (`accepted` /
   * `rejected`) or hand-edited survive every re-scan — otherwise "Re-scan"
   * would silently discard the user's review work.
   */
  async replacePending(workspaceId: string, repoId: string, rows: InsertConvention[]): Promise<ConventionRow[]> {
    await this.db
      .delete(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.status, 'pending'),
        ),
      );
    return this.insertMany(rows);
  }

  async update(workspaceId: string, id: string, patch: UpdateConvention): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.evidenceSnippet !== undefined ? { evidenceSnippet: patch.evidenceSnippet } : {}),
        ...(patch.status !== undefined ? { status: patch.status, accepted: patch.status === 'accepted' } : {}),
        ...(patch.edited !== undefined ? { edited: patch.edited } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }

  /** Most recent `updated_at`/`created_at` for this repo's conventions, i.e.
      "last scan" — null when nothing has been extracted yet. */
  async lastScanAt(workspaceId: string, repoId: string): Promise<Date | null> {
    const rows = await this.list(workspaceId, repoId);
    if (rows.length === 0) return null;
    return rows.reduce<Date>((max, r) => (r.createdAt > max ? r.createdAt : max), rows[0]!.createdAt);
  }
}
