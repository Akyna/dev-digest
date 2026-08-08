import { describe, it, expect } from 'vitest';
import { MockGitClient } from '../src/adapters/mocks.js';
import { sampleRepoFiles } from '../src/modules/conventions/sampling.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';
import { MAX_FILE_BYTES } from '../src/modules/conventions/constants.js';

/**
 * L02 — sampling.ts is pure file I/O with a byte budget, no model call. Covers
 * the config-glob + repo-intel-ranked union, the missing-file no-op, and the
 * per-file byte cap that exists specifically so a file is never truncated
 * (a cut file would shift line numbers and defeat evidence verification).
 */

function fakeRepoIntel(paths: string[]): RepoIntel {
  return {
    getConventionSamples: async () => paths,
  } as unknown as RepoIntel;
}

describe('sampleRepoFiles', () => {
  it('reads existing config files and skips missing ones silently', async () => {
    const git = new MockGitClient({
      files: {
        'package.json': '{"name":"acme"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true}}',
      },
    });
    const out = await sampleRepoFiles(git, fakeRepoIntel([]), { owner: 'acme', name: 'api' }, 'repo-1');
    const paths = out.map((f) => f.path);
    expect(paths).toContain('package.json');
    expect(paths).toContain('tsconfig.json');
    expect(paths).not.toContain('.eslintrc');
  });

  it('includes repo-intel ranked files alongside configs', async () => {
    const git = new MockGitClient({
      files: { 'src/big-file.ts': 'export const x = 1;\n' },
    });
    const out = await sampleRepoFiles(
      git,
      fakeRepoIntel(['src/big-file.ts']),
      { owner: 'acme', name: 'api' },
      'repo-1',
    );
    expect(out.map((f) => f.path)).toContain('src/big-file.ts');
  });

  it('skips a file over the per-file byte cap instead of truncating it', async () => {
    const huge = 'x'.repeat(MAX_FILE_BYTES + 1);
    const git = new MockGitClient({ files: { 'src/huge.ts': huge } });
    const out = await sampleRepoFiles(
      git,
      fakeRepoIntel(['src/huge.ts']),
      { owner: 'acme', name: 'api' },
      'repo-1',
    );
    expect(out.map((f) => f.path)).not.toContain('src/huge.ts');
  });

  it('deduplicates a path that appears in both the config list and repo-intel', async () => {
    const git = new MockGitClient({ files: { 'package.json': '{}' } });
    const out = await sampleRepoFiles(
      git,
      fakeRepoIntel(['package.json']),
      { owner: 'acme', name: 'api' },
      'repo-1',
    );
    expect(out.filter((f) => f.path === 'package.json')).toHaveLength(1);
  });
});
