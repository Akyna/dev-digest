import type { Skill, SkillSource, SkillType } from '@devdigest/shared';
import type { SkillRow, SkillVersionRow } from './repository.js';
import { DEFAULT_SKILL_TYPE } from './constants.js';

/**
 * A1 — pure helpers for the skills module: DB row → DTO mapping, the
 * body-version-bump rule, and the markdown/frontmatter parsing that backs
 * `POST /skills/import/preview`. No I/O, no SQL, no Fastify.
 */

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    ...(row.evidenceFiles != null ? { evidence_files: row.evidenceFiles } : {}),
  };
}

/**
 * A `skill_versions` row on the wire. There is no vendored contract for this
 * (the table is body-only), so the module owns the shape: snake_case like every
 * other DTO, ISO timestamp.
 */
export interface SkillVersion {
  skill_id: string;
  version: number;
  body: string;
  created_at: string;
}

/** Map a persisted `skill_versions` row to the public `SkillVersion` DTO. */
export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * What the Stats tab shows. Deliberately narrow to what is actually tracked
 * today — `skills.version` doubles as the version count (every content change
 * bumps it AND snapshots it, so the two never diverge) and `agent_skills` is
 * the only usage signal that exists. Pull frequency, accept rate and
 * findings-by-category would need a `skill_id` on findings/reviews and event
 * tracking that does not exist yet — out of scope here.
 */
export interface SkillStats {
  skill_id: string;
  versions: number;
  agents_linked: number;
  agents: Array<{ id: string; name: string }>;
}

export function toSkillStatsDto(
  skill: SkillRow,
  agents: Array<{ id: string; name: string }>,
): SkillStats {
  return {
    skill_id: skill.id,
    versions: skill.version,
    agents_linked: agents.length,
    agents,
  };
}

/** Fields whose change bumps the skill's body version (anything but `enabled`). */
export interface ContentChangePatch {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  evidenceFiles?: string[] | null;
  enabled?: boolean;
}

/**
 * True when a patch touches content (vs. just toggling `enabled`). A content
 * change bumps `skills.version` and appends a `skill_versions` snapshot; an
 * enable/disable toggle is a runtime flag and must NOT rewrite history.
 */
export function isContentChange(patch: ContentChangePatch): boolean {
  return Object.entries(patch).some(([key, value]) => key !== 'enabled' && value !== undefined);
}

// ---- markdown / frontmatter parsing -----------------------------------------

export interface ParsedSkillMarkdown {
  name: string;
  description: string;
  /** The markdown WITHOUT the frontmatter block. */
  body: string;
}

/** Frontmatter fence — a bare `---` line at the very start of the document. */
const FRONTMATTER_FENCE = '---';

/** `key: value` at column 0. Indented lines are continuations, never new keys. */
const KEY_LINE = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/;

/** ATX heading (`# Title` … `###### Title`). */
const HEADING_LINE = /^#{1,6}\s+(.*)$/;

/** YAML block-scalar indicators (`>`, `|`, `>-`, `|+`, …) carry no value themselves. */
const BLOCK_INDICATOR = /^[|>][+-]?$/;

/**
 * Split an optional YAML frontmatter block off the front of a markdown document.
 * Returns `frontmatter: null` when there is no well-formed (opened AND closed)
 * block, in which case the whole document is the body.
 */
function splitFrontmatter(md: string): { frontmatter: string[] | null; body: string } {
  const lines = md.split(/\r?\n/);
  if (lines[0]?.trim() !== FRONTMATTER_FENCE) return { frontmatter: null, body: md };
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === FRONTMATTER_FENCE);
  if (end === -1) return { frontmatter: null, body: md };
  return {
    frontmatter: lines.slice(1, end),
    body: lines
      .slice(end + 1)
      .join('\n')
      .replace(/^\n+/, ''),
  };
}

/** Strip one layer of matching surrounding quotes, if present. */
function unquote(value: string): string {
  const v = value.trim();
  const quoted =
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")));
  return quoted ? v.slice(1, -1) : v;
}

/**
 * A deliberately tiny YAML subset: top-level `key: value` scalars, plus folded
 * multi-line scalars where continuation lines are indented (the shape every
 * SKILL.md in `.claude/skills/` uses). No lists, no nesting, no anchors — a real
 * YAML dependency would be a lot of attack surface for two keys.
 */
function parseFrontmatter(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  let key: string | null = null;

  for (const line of lines) {
    const match = /^\S/.test(line) ? KEY_LINE.exec(line) : null;
    if (match) {
      key = match[1]!;
      const raw = match[2]!.trim();
      out[key] = BLOCK_INDICATOR.test(raw) ? '' : raw;
      continue;
    }
    if (key === null) continue;
    const continuation = line.trim();
    if (continuation === '') continue;
    out[key] = out[key] ? `${out[key]} ${continuation}` : continuation;
  }

  for (const [k, v] of Object.entries(out)) out[k] = unquote(v);
  return out;
}

/** Text of the first ATX heading in the body, if any. */
function firstHeading(body: string): string | undefined {
  for (const line of body.split(/\r?\n/)) {
    const match = HEADING_LINE.exec(line.trim());
    if (match) return match[1]!.trim();
  }
  return undefined;
}

/** First blank-line-delimited block that is not a heading, collapsed to one line. */
function firstParagraph(body: string): string | undefined {
  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    const text = block.trim();
    if (text === '' || text.startsWith('#')) continue;
    return text.replace(/\s+/g, ' ');
  }
  return undefined;
}

/** Lowercase kebab-case slug (`"PR Self Review"` → `"pr-self-review"`). */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse a SKILL.md into `{ name, description, body }`.
 *
 * With frontmatter, `name`/`description` come from it (every other key is
 * ignored). Without it — or when a key is missing — `name` is the slugified
 * first heading (falling back to `fallbackName`, usually the uploaded filename)
 * and `description` is the first non-heading paragraph.
 */
export function parseSkillMarkdown(md: string, fallbackName: string): ParsedSkillMarkdown {
  const { frontmatter, body } = splitFrontmatter(md);
  const fm = frontmatter ? parseFrontmatter(frontmatter) : {};

  const heading = firstHeading(body);
  const derivedName = heading ? slugify(heading) : '';
  const name = fm.name?.trim() || derivedName || slugify(fallbackName) || fallbackName;
  const description = fm.description?.trim() || firstParagraph(body) || '';

  return { name, description, body };
}

// ---- classification ----------------------------------------------------------

/**
 * Keyword buckets for `inferSkillType`. Ordered most-specific first: a security
 * checklist is a security skill, not a rubric.
 */
const TYPE_KEYWORDS: ReadonlyArray<readonly [SkillType, readonly string[]]> = [
  [
    'security',
    ['security', 'vulnerab', 'owasp', 'injection', 'xss', 'csrf', 'ssrf', 'secret', 'auth'],
  ],
  ['rubric', ['rubric', 'checklist', 'scoring', 'score', 'criteria', 'grade', 'severity']],
  [
    'convention',
    ['convention', 'style guide', 'styleguide', 'naming', 'lint', 'formatting', 'guideline'],
  ],
];

/**
 * Cheap keyword heuristic over the skill's name + body. Only a starting guess —
 * the import preview is editable before anything is saved.
 */
export function inferSkillType(name: string, body: string): SkillType {
  const haystack = `${name}\n${body}`.toLowerCase();
  for (const [type, keywords] of TYPE_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return type;
  }
  return DEFAULT_SKILL_TYPE;
}

/** Which import decoder a filename asks for — `null` when it is neither. */
export function skillFileKind(filename: string): 'md' | 'zip' | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md';
  if (lower.endsWith('.zip')) return 'zip';
  return null;
}

/** `"skills/my-rule.md"` → `"my-rule"`; used as the parser's name fallback. */
export function filenameStem(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  return base.replace(/\.[^.]+$/, '') || base;
}
