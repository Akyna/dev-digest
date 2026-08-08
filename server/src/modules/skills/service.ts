import type { Container } from '../../platform/container.js';
import type { Skill, SkillSource, SkillType } from '@devdigest/shared';
import { ValidationError } from '../../platform/errors.js';
import { SkillsRepository } from './repository.js';
import { unzipSkillCore } from './archive.js';
import {
  filenameStem,
  inferSkillType,
  parseSkillMarkdown,
  skillFileKind,
  toSkillDto,
  toSkillVersionDto,
  type SkillVersion,
} from './helpers.js';

/**
 * A1 — skills service. Business logic for the Skills tab, the skill editor and
 * the import flow.
 *
 * A Skill = name + description + type + markdown body, linked to agents by the
 * agents module. Every content change is versioned via `skill_versions`
 * (repository), so an edit can always be diffed and restored.
 */


export interface CreateSkillInput {
  name: string;
  description?: string;
  type: SkillType;
  body: string;
  source?: SkillSource;
  enabled?: boolean;
  /** Repo-relative paths backing an `extracted` skill (see L02 conventions). */
  evidenceFiles?: string[];
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/** One uploaded file: markdown text, or a base64 zip. Exactly one of the two. */
export interface ImportSkillInput {
  filename: string;
  content?: string;
  content_b64?: string;
}

/**
 * What the import preview shows before anything is written. Everything here is
 * editable in the UI, and NOTHING has touched the database yet.
 */
export interface SkillImportPreview {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  /** Archive entries that were deliberately not imported (zip only). */
  ignored_files: string[];
  /** Notes to show the user — executable files found, unsafe paths, … */
  warnings: string[];
}

export class SkillsService {
  private repo: SkillsRepository;

  // Takes the whole Container (composition root) like every other service, even
  // though skills only need the db today — no new container entry required.
  constructor(container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map(toSkillDto);
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row) : undefined;
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      type: input.type,
      body: input.body,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.evidenceFiles !== undefined ? { evidenceFiles: input.evidenceFiles } : {}),
    });
    return toSkillDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
    return row ? toSkillDto(row) : undefined;
  }

  /** Delete a skill (and its versions/agent-links, via cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /**
   * Body history for a skill, newest version first. Workspace-scoped: returns
   * undefined when the skill isn't in this workspace (the route maps that to
   * 404) so snapshots can't be read across tenants.
   */
  async listVersions(workspaceId: string, skillId: string): Promise<SkillVersion[] | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const rows = await this.repo.listVersions(skillId);
    return rows.map(toSkillVersionDto);
  }

  /**
   * A single body snapshot. Returns undefined when the skill isn't in this
   * workspace OR that version was never recorded (route → 404).
   */
  async getVersion(
    workspaceId: string,
    skillId: string,
    version: number,
  ): Promise<SkillVersion | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const row = await this.repo.getVersion(skillId, version);
    return row ? toSkillVersionDto(row) : undefined;
  }

  /**
   * Restore an old body. This is a NORMAL update, not a rewrite: restoring v1
   * onto a skill at v2 produces v3 whose body equals v1's. History is
   * append-only, so "undo the restore" is just another restore.
   */
  async restoreVersion(
    workspaceId: string,
    id: string,
    version: number,
  ): Promise<Skill | undefined> {
    const snapshot = await this.getVersion(workspaceId, id, version);
    if (!snapshot) return undefined;
    return this.update(workspaceId, id, { body: snapshot.body });
  }

  /**
   * Parse an uploaded `.md` / `.zip` into an editable draft. Writes NOTHING —
   * the user reviews the parsed name/description/type (and any ignored archive
   * entries) and then POSTs it back as a normal create.
   */
  async importPreview(input: ImportSkillInput): Promise<SkillImportPreview> {
    const kind = skillFileKind(input.filename);
    if (kind === null) {
      throw new ValidationError(`Unsupported file type: ${input.filename}. Expected .md or .zip.`);
    }

    let markdown: string;
    let ignored: string[] = [];
    let warnings: string[] = [];

    if (kind === 'md') {
      if (input.content === undefined) {
        throw new ValidationError('A .md import must provide `content`.');
      }
      markdown = input.content;
    } else {
      if (input.content_b64 === undefined) {
        throw new ValidationError('A .zip import must provide `content_b64`.');
      }
      const archive = unzipSkillCore(new Uint8Array(Buffer.from(input.content_b64, 'base64')));
      if (archive.core === null) {
        throw new ValidationError('No SKILL.md or root-level .md file found in the archive.');
      }
      markdown = archive.core;
      ignored = archive.ignored;
      warnings = archive.warnings;
    }

    if (markdown.trim() === '') throw new ValidationError('The imported skill is empty.');

    const parsed = parseSkillMarkdown(markdown, filenameStem(input.filename));
    return {
      name: parsed.name,
      description: parsed.description,
      type: inferSkillType(parsed.name, parsed.body),
      body: parsed.body,
      ignored_files: ignored,
      warnings,
    };
  }
}
