/**
 * PR-list rollup helpers (`modules/pulls/status.ts`) — the pure derivation that
 * decides each PR's review STATUS and tallies its FINDINGS for the list. The DB
 * `status` column holds GitHub's merge state; the review status
 * (needs_review / reviewed / stale) is derived here from head vs lastReviewedSha
 * + age, so it gets unit coverage independent of the route's queries.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveReviewStatus,
  rollupSeverities,
  sortFindingsForSummary,
  STALE_DAYS,
  type FindingSummaryRow,
} from '../src/modules/pulls/status.js';

const DAY = 86_400_000;
const now = Date.UTC(2026, 5, 11);

describe('deriveReviewStatus', () => {
  it('needs_review when never reviewed, or when head moved since the last review', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: null, headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'old', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
  });

  it('reviewed when the current head was reviewed and the PR is recent', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now - DAY), now }),
    ).toBe('reviewed');
  });

  it('stale when the current head was reviewed but the PR is older than STALE_DAYS', () => {
    expect(
      deriveReviewStatus({
        ghStatus: 'open',
        lastReviewedSha: 'abc',
        headSha: 'abc',
        updatedAt: new Date(now - (STALE_DAYS + 1) * DAY),
        now,
      }),
    ).toBe('stale');
  });

  it('keeps merged/closed regardless of review state', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'merged', lastReviewedSha: null, headSha: 'abc', updatedAt: null, now }),
    ).toBe('merged');
    expect(
      deriveReviewStatus({ ghStatus: 'closed', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('closed');
  });
});

describe('rollupSeverities', () => {
  it('tallies findings into critical / warning / suggestion buckets (ignores unknown)', () => {
    expect(
      rollupSeverities([
        { severity: 'CRITICAL' },
        { severity: 'CRITICAL' },
        { severity: 'WARNING' },
        { severity: 'SUGGESTION' },
        { severity: 'WEIRD' },
      ]),
    ).toEqual({ critical: 2, warning: 1, suggestion: 1 });
  });

  it('is all-zero for no findings', () => {
    expect(rollupSeverities([])).toEqual({ critical: 0, warning: 0, suggestion: 0 });
  });
});

function row(o: Partial<FindingSummaryRow>): FindingSummaryRow {
  return {
    id: 'f1',
    file: 'src/config.ts',
    startLine: 12,
    endLine: 12,
    severity: 'CRITICAL',
    category: 'security',
    title: 'Hardcoded secret',
    rationale: 'A secret is committed.',
    suggestion: null,
    confidence: 0.9,
    kind: 'finding',
    ...o,
  };
}

describe('sortFindingsForSummary', () => {
  it('orders CRITICAL → WARNING → SUGGESTION, ignoring input order', () => {
    const out = sortFindingsForSummary([
      row({ id: 'sugg', severity: 'SUGGESTION' }),
      row({ id: 'crit', severity: 'CRITICAL' }),
      row({ id: 'warn', severity: 'WARNING' }),
    ]);
    expect(out.map((f) => f.id)).toEqual(['crit', 'warn', 'sugg']);
  });

  it('breaks ties within a severity by confidence, descending', () => {
    const out = sortFindingsForSummary([
      row({ id: 'low', severity: 'WARNING', confidence: 0.6 }),
      row({ id: 'high', severity: 'WARNING', confidence: 0.9 }),
    ]);
    expect(out.map((f) => f.id)).toEqual(['high', 'low']);
  });

  it('maps DB column names to the Finding contract shape (start_line/end_line, nullable suggestion)', () => {
    const [out] = sortFindingsForSummary([row({ id: 'f1', startLine: 10, endLine: 14, suggestion: 'Use env vars.' })]);
    expect(out).toMatchObject({
      id: 'f1',
      start_line: 10,
      end_line: 14,
      suggestion: 'Use env vars.',
    });
  });
});
