import { z } from 'zod';
import { ConventionCandidate } from '@devdigest/shared';
import type { ConventionRow } from './repository.js';

export function slugifyRule(rule: string): string {
  return (
    rule
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'rule'
  );
}

/** Kebab-cases a repo name for use in a generated skill name — repo.name is
    normally already clean, but this guards against spaces/slashes so the
    result always satisfies the skill-name regex in `skills/routes.ts`. */
function slugRepoName(repoName: string): string {
  return repoName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function suggestSkillName(repoName: string): string {
  return `${slugRepoName(repoName)}-conventions`;
}

export function suggestSkillDescription(count: number, repoName: string): string {
  return `${count} house convention${count === 1 ? '' : 's'} extracted from ${repoName}`;
}

/** Extends the vendored `ConventionCandidate` contract with the fields this
    module adds (category/status/evidence_line/…) rather than editing the
    vendored file — see do-not-touch in the root CLAUDE.md. */
export const ConventionDto = ConventionCandidate.extend({
  category: z.string().nullable(),
  evidence_line: z.number().int().nullable(),
  evidence_end_line: z.number().int().nullable(),
  status: z.enum(['pending', 'accepted', 'rejected']),
  support_count: z.number().int(),
  edited: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function toConventionDto(row: ConventionRow): {
  id: string;
  rule: string;
  evidence_path: string;
  evidence_snippet: string;
  confidence: number;
  accepted: boolean;
  category: string | null;
  evidence_line: number | null;
  evidence_end_line: number | null;
  status: 'pending' | 'accepted' | 'rejected';
  support_count: number;
  edited: boolean;
  created_at: string;
  updated_at: string;
} {
  return {
    id: row.id,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    accepted: row.status === 'accepted',
    category: row.category,
    evidence_line: row.evidenceLine,
    evidence_end_line: row.evidenceEndLine,
    status: row.status,
    support_count: row.supportCount,
    edited: row.edited,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** `path:line` or `path:startLine-endLine` for the "Detected in" line —
    a range when the grounded snippet spans more than one line. */
function evidenceLocation(path: string, line: number | null, endLine: number | null): string {
  if (!line) return path;
  if (endLine && endLine > line) return `${path}:${line}-${endLine}`;
  return `${path}:${line}`;
}

/**
 * Markdown body for a skill assembled from the ACCEPTED convention rows the
 * user selected. One `##` section per rule — heading is the rule's slug, body
 * is the (already Always/Never-phrased) rule sentence, then its `file:line`
 * evidence and a fenced snippet, so the resulting skill is itself auditable.
 */
export function buildSkillBody(
  candidates: {
    rule: string;
    evidence_path: string;
    evidence_line: number | null;
    evidence_end_line?: number | null;
    evidence_snippet: string;
  }[],
  repoName: string,
): string {
  const intro = `House conventions for \`${repoName}\`. Flag changes that violate any rule below and cite the offending \`file:line\`.`;

  const sections = candidates.map((c) => {
    const loc = evidenceLocation(c.evidence_path, c.evidence_line, c.evidence_end_line ?? null);
    return [
      `## ${slugifyRule(c.rule)}`,
      c.rule,
      '',
      `Detected in \`${loc}\`:`,
      '```',
      c.evidence_snippet,
      '```',
    ].join('\n');
  });

  return [`# ${suggestSkillName(repoName)}`, '', intro, '', ...sections].join('\n\n');
}
