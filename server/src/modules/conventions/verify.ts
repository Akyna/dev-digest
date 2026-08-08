import type { SampledFile } from './sampling.js';
import type { ConventionCandidateProposal } from './prompts.js';
import type { ConventionSignal } from './signals.js';
import { MIN_CONFIDENCE } from './constants.js';

export interface VerifiedConvention {
  category: string;
  rule: string;
  evidence_path: string;
  evidence_line: number;
  /** Set when the (grounded) snippet spans more than one line; null for a
      single-line match. */
  evidence_end_line: number | null;
  evidence_snippet: string;
  confidence: number;
  support_count: number;
}

export interface DroppedCandidate {
  candidate: ConventionCandidateProposal;
  reason: string;
}

export interface VerifyResult {
  kept: VerifiedConvention[];
  dropped: DroppedCandidate[];
}

/** Collapse whitespace so a candidate's copy of a line survives re-indentation
    or trailing-space differences between what the model echoed and the file. */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Token overlap used both to find a moved snippet and to dedup near-identical
    rules — cheap, deterministic, no embeddings required for a same-repo pass. */
function tokenSet(s: string): Set<string> {
  return new Set(
    normalize(s)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const DEDUP_THRESHOLD = 0.6;

/** A snippet's non-empty lines, each whitespace-normalized — the unit both
    the file-content search and the support count operate on, so a two-line
    quote (e.g. a decorator + the field it decorates) is grounded as a single
    contiguous span rather than two unrelated single-line matches. */
function snippetPattern(snippet: string): string[] {
  return snippet
    .split('\n')
    .map(normalize)
    .filter((l) => l.length > 0);
}

/**
 * Every 1-indexed start line in `fileLines` where `pattern` matches a
 * contiguous window — each pattern line must be `included in` (not
 * necessarily equal to) the corresponding file line, so a partial-line quote
 * still grounds. Returns every match (used for both "does it exist at all"
 * and the support count), not just the first.
 */
function findSpans(fileLines: string[], pattern: string[]): number[] {
  if (pattern.length === 0 || pattern.length > fileLines.length) return [];
  const starts: number[] = [];
  for (let i = 0; i <= fileLines.length - pattern.length; i++) {
    let ok = true;
    for (let k = 0; k < pattern.length; k++) {
      if (!normalize(fileLines[i + k] ?? '').includes(pattern[k]!)) {
        ok = false;
        break;
      }
    }
    if (ok) starts.push(i + 1);
  }
  return starts;
}

/**
 * Grounds each proposed candidate against the file content the model was
 * actually shown — the trust boundary between "the model said" and "the repo
 * has". Mirrors the shape of `groundFindings` in reviewer-core/src/grounding.ts
 * (kept/dropped with reasons), but grounds against sampled FILE CONTENT rather
 * than a diff, so it lives here instead of being shared.
 *
 * Steps, in order:
 *  1. file must be one of the sampled files, else drop ('file not sampled');
 *  2. the snippet's lines (normalized) must match a contiguous span in that
 *     file — if the span is at a different start line than claimed, CORRECT
 *     `evidence_line`/`evidence_end_line` rather than dropping (the model can
 *     misjudge a line number while still quoting real text);
 *  3. `support_count` = how many times that exact span pattern recurs in the
 *     file (a rough "how consistent is this");
 *  4. dedup near-identical rules (token-set Jaccard over the rule text),
 *     merging support_count into the first occurrence;
 *  5. calibrate confidence by support, then drop anything under MIN_CONFIDENCE.
 */
export function verifyCandidates(
  candidates: ConventionCandidateProposal[],
  files: SampledFile[],
  signals: ConventionSignal[],
): VerifyResult {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const kept: VerifiedConvention[] = [];
  const dropped: DroppedCandidate[] = [];

  for (const c of candidates) {
    const file = byPath.get(c.evidence_path);
    if (!file) {
      dropped.push({ candidate: c, reason: `file '${c.evidence_path}' not sampled` });
      continue;
    }

    const pattern = snippetPattern(c.evidence_snippet);
    if (pattern.length === 0) {
      dropped.push({ candidate: c, reason: 'empty evidence_snippet' });
      continue;
    }

    const lines = file.content.split('\n');
    const spans = findSpans(lines, pattern);
    if (spans.length === 0) {
      dropped.push({ candidate: c, reason: 'evidence_snippet not found in file' });
      continue;
    }

    // Prefer the model's claimed line when it's a genuine match; otherwise
    // auto-correct to the first real occurrence rather than dropping.
    const start = spans.includes(c.evidence_line) ? c.evidence_line : spans[0]!;
    const end = start + pattern.length - 1;

    kept.push({
      category: c.category,
      rule: c.rule,
      evidence_path: c.evidence_path,
      evidence_line: start,
      evidence_end_line: end > start ? end : null,
      evidence_snippet: c.evidence_snippet,
      confidence: c.confidence,
      support_count: Math.max(1, spans.length),
    });
  }

  // Merge in the deterministic config signals (already grounded, no verify needed).
  for (const s of signals) {
    kept.push({
      category: s.category,
      rule: s.rule,
      evidence_path: s.evidence_path,
      evidence_line: s.evidence_line,
      evidence_end_line: null,
      evidence_snippet: s.evidence_snippet,
      confidence: s.confidence,
      support_count: s.support_count,
    });
  }

  const deduped = dedupe(kept);
  const calibrated = deduped
    .map((c) => ({ ...c, confidence: calibrate(c.confidence, c.support_count) }))
    .filter((c) => c.confidence >= MIN_CONFIDENCE);

  return { kept: calibrated, dropped };
}

function dedupe(items: VerifiedConvention[]): VerifiedConvention[] {
  const out: VerifiedConvention[] = [];
  for (const item of items) {
    const itemTokens = tokenSet(item.rule);
    const dupe = out.find((o) => jaccard(tokenSet(o.rule), itemTokens) >= DEDUP_THRESHOLD);
    if (dupe) {
      dupe.support_count += item.support_count;
      dupe.confidence = Math.max(dupe.confidence, item.confidence);
    } else {
      out.push({ ...item });
    }
  }
  return out;
}

/** More supporting occurrences → higher trust, with diminishing returns. */
function calibrate(confidence: number, supportCount: number): number {
  const factor = Math.min(1, 0.7 + 0.1 * Math.log2(1 + supportCount));
  return Math.min(1, confidence * factor);
}
