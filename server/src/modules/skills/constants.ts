/** Constants for the skills module. */

import type { SkillSource, SkillType } from '@devdigest/shared';

/** Initial body version recorded for a newly-created skill. */
export const INITIAL_SKILL_VERSION = 1;

/** Default skill description when none is supplied on insert. */
export const DEFAULT_SKILL_DESCRIPTION = '';

/** Skills created through the API are hand-authored unless stated otherwise. */
export const DEFAULT_SKILL_SOURCE: SkillSource = 'manual';

/** Fallback type when the keyword heuristic finds nothing it recognises. */
export const DEFAULT_SKILL_TYPE: SkillType = 'custom';

// ---- import / archive guards -------------------------------------------------

/** The conventional name of the skill body inside an archive (any depth). */
export const SKILL_CORE_FILENAME = 'SKILL.md';

/** Zip-bomb guard: refuse archives with more entries than this. */
export const MAX_ARCHIVE_ENTRIES = 200;

/** Zip-bomb guard: refuse archives whose total UNCOMPRESSED size exceeds this. */
export const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;

/** A skill body is prose — anything larger than this is not a skill. */
export const MAX_CORE_BYTES = 256 * 1024;

/**
 * Extensions that look executable. Nothing in an archive is ever run or written
 * to disk, but the UI warns the user that the archive carried these so an
 * "install script" silently going nowhere is not a surprise.
 */
export const EXECUTABLE_EXTENSIONS = [
  '.sh',
  '.bash',
  '.zsh',
  '.js',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.exe',
  '.bat',
  '.ps1',
] as const;

/**
 * `POST /skills/import/preview` carries a base64 archive, so it needs more room
 * than the global 1 MB `bodyLimit` in app.ts (base64 inflates by ~4/3, and
 * MAX_ARCHIVE_BYTES is 5 MB uncompressed).
 */
export const IMPORT_BODY_LIMIT = 4 * 1024 * 1024;
