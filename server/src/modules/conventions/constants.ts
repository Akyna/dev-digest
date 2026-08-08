/** L02 — conventions module literals. */

/** Config files read verbatim (not through repo-intel rank) — always sampled
    when present, since they are the cheapest, highest-signal source. */
export const CONFIG_SAMPLE_GLOBS = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  'tsconfig.json',
  'package.json',
  '.editorconfig',
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mts',
] as const;

/** How many repo-intel top-ranked source files to sample alongside configs. */
export const RANKED_SAMPLE_COUNT = 12;

/** Per-file byte cap (a file over this is skipped, not truncated — a truncated
    file could shift line numbers and defeat evidence verification). */
export const MAX_FILE_BYTES = 20_000;

/** Cap on total sampled bytes handed to the model. */
export const MAX_SAMPLE_BYTES = 120_000;

/** Candidates below this calibrated confidence are dropped in verify.ts. */
export const MIN_CONFIDENCE = 0.4;

// Cheap default when the workspace hasn't overridden the 'conventions' feature
// model in Settings — same provider/model the other cheap passes use (e.g. the
// seeded agents' default in db/seed.ts), NOT the vendored FEATURE_MODELS
// registry default (openai/gpt-5.4), which requires a key most workspaces
// running this course locally don't have configured.
export const DEFAULT_PROVIDER = 'openrouter' as const;
export const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';
