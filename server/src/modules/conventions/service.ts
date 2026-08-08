import { and, eq } from 'drizzle-orm';
import type { Container } from '../../platform/container.js';
import type { ConventionCandidate, SkillType } from '@devdigest/shared';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import * as t from '../../db/schema.js';
import { getFeatureModelOverride } from '../settings/feature-models.js';
import { SkillsService } from '../skills/service.js';
import { AgentsService } from '../agents/service.js';
import { sampleRepoFiles } from './sampling.js';
import { extractSignals, signalsDigest } from './signals.js';
import {
  ConventionFileSelection,
  ConventionExtraction,
  fileSelectionMessages,
  extractionMessages,
  type ConventionCandidateProposal,
} from './prompts.js';
import { verifyCandidates } from './verify.js';
import { ConventionsRepository, type ConventionRow, type InsertConvention } from './repository.js';
import { buildSkillBody, suggestSkillDescription, suggestSkillName, toConventionDto } from './helpers.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from './constants.js';

export interface ExtractStats {
  sampled: number;
  proposed: number;
  verified: number;
  dropped: number;
}

export interface ExtractResult {
  candidates: ConventionCandidate[];
  stats: ExtractStats;
}

export interface UpdateConventionInput {
  status?: 'pending' | 'accepted' | 'rejected';
  rule?: string;
  category?: string;
  evidence_snippet?: string;
}

export interface SkillDraftInput {
  convention_ids: string[];
}

export interface SkillDraft {
  name: string;
  description: string;
  body: string;
}

export interface CreateSkillFromConventionsInput extends SkillDraftInput {
  name: string;
  description?: string;
  type: SkillType;
  enabled?: boolean;
  body: string;
  agent_ids?: string[];
}

/**
 * L02 — conventions service: repo scan → candidate proposals → verify →
 * accept/reject → draft/create a skill from the accepted set.
 *
 * The quality contract: the model only PROPOSES; `verify.ts` is the only code
 * allowed to decide a candidate survives. No candidate reaches the DB (and so
 * never reaches the UI) without a real file:line match in the sampled clone.
 */
export class ConventionsService {
  private repo: ConventionsRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  private async repoRef(workspaceId: string, repoId: string) {
    const [row] = await this.container.db
      .select({
        id: t.repos.id,
        owner: t.repos.owner,
        name: t.repos.name,
        clonePath: t.repos.clonePath,
      })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    if (!row) throw new NotFoundError('Repo not found');
    if (!row.clonePath) throw new ValidationError('Repo has not finished cloning yet');
    return row;
  }

  async list(workspaceId: string, repoId: string): Promise<{ candidates: ConventionCandidate[]; last_scan_at: string | null }> {
    await this.repoRef(workspaceId, repoId);
    const rows = await this.repo.list(workspaceId, repoId);
    const lastScan = await this.repo.lastScanAt(workspaceId, repoId);
    return {
      candidates: rows.map(toConventionDto),
      last_scan_at: lastScan ? lastScan.toISOString() : null,
    };
  }

  /**
   * Run the extraction pipeline synchronously: sample → deterministic signals
   * → 2-step LLM proposal → verify → persist (replacing prior `pending` rows).
   */
  async extract(workspaceId: string, repoId: string): Promise<ExtractResult> {
    const repo = await this.repoRef(workspaceId, repoId);
    const files = await sampleRepoFiles(this.container.git, this.container.repoIntel, repo, repoId);

    const signals = extractSignals(files);
    const digest = signalsDigest(signals);

    const modelChoice =
      (await getFeatureModelOverride(this.container, workspaceId, 'conventions')) ?? {
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
      };
    const llm = await this.container.llm(modelChoice.provider);

    let selectedPaths = files.map((f) => f.path);
    if (files.length > 0) {
      const selection = await llm.completeStructured({
        model: modelChoice.model,
        schema: ConventionFileSelection,
        schemaName: 'ConventionFileSelection',
        messages: fileSelectionMessages(files.map((f) => f.path)),
      });
      const picked = new Set(selection.data.paths);
      const narrowed = files.filter((f) => picked.has(f.path));
      if (narrowed.length > 0) selectedPaths = narrowed.map((f) => f.path);
    }
    const readFiles = files.filter((f) => selectedPaths.includes(f.path));

    let proposals: ConventionCandidateProposal[] = [];
    if (readFiles.length > 0) {
      const extraction = await llm.completeStructured({
        model: modelChoice.model,
        schema: ConventionExtraction,
        schemaName: 'ConventionExtraction',
        messages: extractionMessages(readFiles, digest),
      });
      proposals = extraction.data.candidates;
    }

    const { kept, dropped } = verifyCandidates(proposals, files, signals);

    const toInsert: InsertConvention[] = kept.map((c) => ({
      workspaceId,
      repoId,
      rule: c.rule,
      category: c.category,
      evidencePath: c.evidence_path,
      evidenceSnippet: c.evidence_snippet,
      evidenceLine: c.evidence_line,
      evidenceEndLine: c.evidence_end_line,
      confidence: c.confidence,
      supportCount: c.support_count,
    }));

    const rows = await this.repo.replacePending(workspaceId, repoId, toInsert);

    return {
      candidates: rows.map(toConventionDto),
      stats: {
        sampled: files.length,
        proposed: proposals.length + signals.length,
        verified: kept.length,
        dropped: dropped.length,
      },
    };
  }

  async update(workspaceId: string, id: string, patch: UpdateConventionInput): Promise<ConventionCandidate> {
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) throw new NotFoundError('Convention not found');

    const contentChanged = patch.rule !== undefined || patch.category !== undefined || patch.evidence_snippet !== undefined;
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.evidence_snippet !== undefined ? { evidenceSnippet: patch.evidence_snippet } : {}),
      ...(contentChanged ? { edited: true } : {}),
    });
    if (!row) throw new NotFoundError('Convention not found');
    return toConventionDto(row);
  }

  private async acceptedRows(workspaceId: string, ids: string[]): Promise<ConventionRow[]> {
    if (ids.length === 0) throw new ValidationError('Select at least one convention');
    const rows = await this.repo.getByIds(workspaceId, ids);
    if (rows.length !== ids.length) throw new NotFoundError('One or more conventions not found');
    return rows;
  }

  async skillDraft(workspaceId: string, repoId: string, input: SkillDraftInput): Promise<SkillDraft> {
    const repo = await this.repoRef(workspaceId, repoId);
    const rows = await this.acceptedRows(workspaceId, input.convention_ids);
    return {
      name: suggestSkillName(repo.name),
      description: suggestSkillDescription(rows.length, repo.name),
      body: buildSkillBody(rows.map(toConventionDto), repo.name),
    };
  }

  /**
   * Create the skill (`source: 'extracted'`, evidence_files = the distinct
   * evidence paths behind the selected conventions) and, if `agent_ids` is
   * given, link it to each agent via the existing AgentsService — reusing the
   * agents module's own dedupe/order/validation rather than duplicating it.
   */
  async createSkill(workspaceId: string, repoId: string, input: CreateSkillFromConventionsInput) {
    await this.repoRef(workspaceId, repoId);
    const rows = await this.acceptedRows(workspaceId, input.convention_ids);
    const evidenceFiles = [...new Set(rows.map((r) => r.evidencePath).filter((p): p is string => !!p))];

    const skillsService = new SkillsService(this.container);
    const skill = await skillsService.create(workspaceId, {
      name: input.name,
      description: input.description,
      type: input.type,
      body: input.body,
      source: 'extracted',
      enabled: input.enabled,
      evidenceFiles,
    });

    if (input.agent_ids?.length) {
      const agentsService = new AgentsService(this.container);
      for (const agentId of input.agent_ids) {
        await agentsService.linkSkill(workspaceId, agentId, skill.id);
      }
    }

    return skillsService.get(workspaceId, skill.id);
  }
}
