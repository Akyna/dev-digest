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

export function suggestSkillName(repoName: string): string {
  return `${repoName} conventions`;
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

/**
 * Markdown body for a skill assembled from the ACCEPTED convention rows the
 * user selected. One `##` section per rule, each carrying its `file:line`
 * evidence and a fenced snippet, so the resulting skill is itself auditable.
 */
export function buildSkillBody(
  candidates: { category: string | null; rule: string; evidence_path: string; evidence_line: number | null; evidence_snippet: string }[],
  repoName: string,
): string {
  const intro = `Conventions extracted from \`${repoName}\`. Each rule below was observed in the repository's own source — see the linked evidence.`;

  const byCategory = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const key = c.category ?? 'general';
    const arr = byCategory.get(key) ?? [];
    arr.push(c);
    byCategory.set(key, arr);
  }

  const sections = [...byCategory.entries()].map(([category, rules]) => {
    const body = rules
      .map((c) => {
        const loc = c.evidence_line ? `${c.evidence_path}:${c.evidence_line}` : c.evidence_path;
        return [
          `### ${slugifyRule(c.rule).replace(/-/g, ' ')}`,
          '',
          c.rule,
          '',
          `Detected in \`${loc}\``,
          '',
          '```',
          c.evidence_snippet,
          '```',
        ].join('\n');
      })
      .join('\n\n');
    return `## ${category}\n\n${body}`;
  });

  return [`# ${suggestSkillName(repoName)}`, '', intro, '', ...sections].join('\n\n');
}
