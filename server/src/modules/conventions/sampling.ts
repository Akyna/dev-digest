import type { GitClient, RepoRef } from '@devdigest/shared';
import type { RepoIntel } from '../repo-intel/types.js';
import { CONFIG_SAMPLE_GLOBS, MAX_FILE_BYTES, MAX_SAMPLE_BYTES, RANKED_SAMPLE_COUNT } from './constants.js';

export interface SampledFile {
  path: string;
  content: string;
}

/**
 * Build the file sample the model reasons over: the fixed config-file list
 * (whichever of them exist) plus the top-ranked source files from repo-intel
 * (already filtered to drop tests/configs/migrations). No model call here —
 * this is pure file I/O with a byte budget, so a bad clone never costs tokens.
 *
 * Reads go through `git.readFile`, which throws on a missing path; a missing
 * file is expected (most repos have only some of the config globs) and is
 * silently skipped rather than surfaced as an error.
 */
export async function sampleRepoFiles(
  git: GitClient,
  repoIntel: RepoIntel,
  repo: RepoRef,
  repoId: string,
): Promise<SampledFile[]> {
  const paths = [...CONFIG_SAMPLE_GLOBS, ...(await repoIntel.getConventionSamples(repoId, RANKED_SAMPLE_COUNT))];

  const out: SampledFile[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (totalBytes >= MAX_SAMPLE_BYTES) break;

    let content: string;
    try {
      content = await git.readFile(repo, path);
    } catch {
      continue; // not present in this repo — expected for most of the config globs
    }
    if (content.length === 0) continue;

    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_FILE_BYTES) continue; // never truncate: a cut file shifts line numbers
    if (totalBytes + bytes > MAX_SAMPLE_BYTES) continue;

    out.push({ path, content });
    totalBytes += bytes;
  }

  return out;
}
