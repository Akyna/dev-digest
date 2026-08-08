import { describe, it, expect } from 'vitest';
import { verifyCandidates } from '../src/modules/conventions/verify.js';
import { buildSkillBody } from '../src/modules/conventions/helpers.js';
import type { SampledFile } from '../src/modules/conventions/sampling.js';
import type { ConventionCandidateProposal } from '../src/modules/conventions/prompts.js';

/**
 * L02 — hermetic tests for the conventions quality gate. verify.ts is the only
 * code allowed to decide a model-proposed candidate survives into the DB/UI,
 * so its edge cases (missing file, wrong line, dedup, low-confidence drop) are
 * covered here without any DB or LLM call.
 */

function proposal(overrides: Partial<ConventionCandidateProposal>): ConventionCandidateProposal {
  return {
    category: 'naming',
    rule: 'Use camelCase for variables.',
    evidence_path: 'src/foo.ts',
    evidence_line: 1,
    evidence_snippet: 'const fooBar = 1;',
    confidence: 0.9,
    ...overrides,
  };
}

describe('verifyCandidates', () => {
  it('drops a candidate whose file was never sampled', () => {
    const files: SampledFile[] = [{ path: 'src/foo.ts', content: 'const fooBar = 1;\n' }];
    const { kept, dropped } = verifyCandidates(
      [proposal({ evidence_path: 'src/bar.ts' })],
      files,
      [],
    );
    expect(kept).toHaveLength(0);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.reason).toMatch(/not sampled/);
  });

  it('drops a candidate whose snippet is not actually in the file', () => {
    const files: SampledFile[] = [{ path: 'src/foo.ts', content: 'const fooBar = 1;\n' }];
    const { kept, dropped } = verifyCandidates(
      [proposal({ evidence_snippet: 'this text does not exist' })],
      files,
      [],
    );
    expect(kept).toHaveLength(0);
    expect(dropped[0]!.reason).toMatch(/not found/);
  });

  it('auto-corrects evidence_line when the snippet is on a different line', () => {
    const files: SampledFile[] = [
      { path: 'src/foo.ts', content: 'line one\nline two\nconst fooBar = 1;\nline four\n' },
    ];
    const { kept, dropped } = verifyCandidates(
      [proposal({ evidence_line: 1, confidence: 1 })],
      files,
      [],
    );
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.evidence_line).toBe(3);
  });

  it('dedupes near-identical rules and merges support_count', () => {
    const files: SampledFile[] = [
      { path: 'src/foo.ts', content: 'const fooBar = 1;\n' },
      { path: 'src/bar.ts', content: 'const bazQux = 2;\n' },
    ];
    const { kept } = verifyCandidates(
      [
        proposal({ rule: 'Use camelCase for variable names.', confidence: 0.9 }),
        proposal({
          rule: 'Use camelCase for variable names',
          evidence_path: 'src/bar.ts',
          evidence_snippet: 'const bazQux = 2;',
          confidence: 0.8,
        }),
      ],
      files,
      [],
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]!.support_count).toBeGreaterThanOrEqual(2);
  });

  it('drops candidates below MIN_CONFIDENCE after calibration', () => {
    const files: SampledFile[] = [{ path: 'src/foo.ts', content: 'const fooBar = 1;\n' }];
    const { kept } = verifyCandidates([proposal({ confidence: 0.1 })], files, []);
    expect(kept).toHaveLength(0);
  });

  it('passes deterministic signals straight through as kept', () => {
    const { kept } = verifyCandidates(
      [],
      [],
      [
        {
          category: 'type-safety',
          rule: 'TypeScript strict mode is enabled.',
          evidence_path: 'tsconfig.json',
          evidence_line: 3,
          evidence_snippet: '"strict": true',
          confidence: 1,
          support_count: 1,
        },
      ],
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]!.rule).toMatch(/strict mode/);
  });
});

describe('buildSkillBody', () => {
  it('renders one section per accepted rule with clickable file:line evidence', () => {
    const body = buildSkillBody(
      [
        {
          category: 'naming',
          rule: 'Use camelCase for variables.',
          evidence_path: 'src/foo.ts',
          evidence_line: 3,
          evidence_snippet: 'const fooBar = 1;',
        },
      ],
      'acme/payments-api',
    );
    expect(body).toContain('# acme-payments-api-conventions');
    expect(body).toContain('## naming');
    expect(body).toContain('Use camelCase for variables.');
    expect(body).toContain('Detected in `src/foo.ts:3`');
    expect(body).toContain('const fooBar = 1;');
  });

  it('groups multiple rules under the same category heading', () => {
    const body = buildSkillBody(
      [
        {
          category: 'testing',
          rule: 'Tests run on Vitest.',
          evidence_path: 'package.json',
          evidence_line: 5,
          evidence_snippet: '"test": "vitest"',
        },
        {
          category: 'testing',
          rule: 'Test files end in .test.ts.',
          evidence_path: 'test/foo.test.ts',
          evidence_line: 1,
          evidence_snippet: 'describe(...)',
        },
      ],
      'acme/payments-api',
    );
    expect(body.match(/## testing/g)).toHaveLength(1);
  });
});
