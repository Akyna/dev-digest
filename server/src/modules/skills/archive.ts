import { unzipSync } from 'fflate';
import { ValidationError } from '../../platform/errors.js';
import {
  EXECUTABLE_EXTENSIONS,
  MAX_ARCHIVE_BYTES,
  MAX_ARCHIVE_ENTRIES,
  MAX_CORE_BYTES,
  SKILL_CORE_FILENAME,
} from './constants.js';

/**
 * A1 — in-memory zip reader for skill imports.
 *
 * A community "skill" often ships as an archive with an install script, hooks,
 * assets and a README next to the actual SKILL.md. We take the markdown core and
 * NOTHING else: every other entry is listed in `ignored` and is never decoded as
 * a skill, never written to disk, and never executed. Executable-looking entries
 * additionally raise a warning the UI shows on screen, so a user who expected
 * `install.sh` to run learns that it did not.
 *
 * Decompression is two-pass on purpose: the first pass uses fflate's `filter`
 * hook to walk the central directory WITHOUT inflating anything, so the
 * zip-bomb guards below are enforced before a single byte is expanded. Only the
 * chosen core is inflated in the second pass.
 */

export interface SkillArchive {
  /** UTF-8 text of the skill core, or null when the archive has no markdown. */
  core: string | null;
  /** Archive-relative path of the core (for messaging), or null. */
  coreName: string | null;
  /** Every entry that is NOT the core. Listed only — never used. */
  ignored: string[];
  /** Human-readable notes surfaced in the import preview UI. */
  warnings: string[];
}

interface EntryInfo {
  name: string;
  originalSize: number;
}

/** Directory entries carry no content and are not "files" for our purposes. */
function isDirectory(name: string): boolean {
  return name.endsWith('/');
}

/** Absolute paths and `..` traversal — we never write files, but we never trust them either. */
function isUnsafePath(name: string): boolean {
  return (
    name.startsWith('/') ||
    name.startsWith('\\') ||
    /^[a-zA-Z]:[\\/]/.test(name) ||
    name.split(/[\\/]/).includes('..')
  );
}

function hasExecutableExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return EXECUTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Nesting depth — `SKILL.md` is 0, `a/SKILL.md` is 1. Shallowest core wins. */
function depth(name: string): number {
  return name.split('/').length - 1;
}

/**
 * Pick the skill core: an entry named SKILL.md (any depth, shallowest first),
 * otherwise the first `*.md` sitting in the archive root. Ties break
 * lexicographically so the same archive always yields the same skill.
 */
function pickCore(entries: EntryInfo[]): EntryInfo | undefined {
  const candidates = entries.filter((e) => !isUnsafePath(e.name));

  const named = candidates
    .filter((e) => (e.name.split('/').pop() ?? '').toLowerCase() === SKILL_CORE_FILENAME.toLowerCase())
    .sort((a, b) => depth(a.name) - depth(b.name) || a.name.localeCompare(b.name));
  if (named[0]) return named[0];

  return candidates
    .filter((e) => depth(e.name) === 0 && e.name.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.name.localeCompare(b.name))[0];
}

/**
 * Read a skill out of a zip archive held entirely in memory.
 *
 * @throws ValidationError when the archive is corrupt or trips a size/count guard.
 */
export function unzipSkillCore(bytes: Uint8Array): SkillArchive {
  const entries: EntryInfo[] = [];

  // Pass 1 — enumerate the central directory. The filter always returns false,
  // so nothing is inflated and a zip bomb never gets the chance to expand.
  try {
    unzipSync(bytes, {
      filter: (file) => {
        entries.push({ name: file.name, originalSize: file.originalSize });
        return false;
      },
    });
  } catch (err) {
    throw new ValidationError(`Could not read the zip archive: ${(err as Error).message}`);
  }

  const files = entries.filter((e) => !isDirectory(e.name));

  if (files.length > MAX_ARCHIVE_ENTRIES) {
    throw new ValidationError(
      `Archive has ${files.length} entries; the limit is ${MAX_ARCHIVE_ENTRIES}.`,
    );
  }
  const totalBytes = files.reduce((sum, e) => sum + e.originalSize, 0);
  if (totalBytes > MAX_ARCHIVE_BYTES) {
    throw new ValidationError(
      `Archive expands to ${totalBytes} bytes; the limit is ${MAX_ARCHIVE_BYTES}.`,
    );
  }

  const core = pickCore(files);
  const ignored = files.filter((e) => e.name !== core?.name).map((e) => e.name);

  const warnings: string[] = [];
  const executables = ignored.filter(hasExecutableExtension);
  if (executables.length > 0) {
    warnings.push(
      `Archive contains executable files (${executables.join(', ')}). They were ignored — DevDigest imports the skill text only and never runs archive contents.`,
    );
  }
  const unsafe = files.filter((e) => isUnsafePath(e.name)).map((e) => e.name);
  if (unsafe.length > 0) {
    warnings.push(
      `Archive contains unsafe paths (${unsafe.join(', ')}). They were ignored — nothing is written to disk.`,
    );
  }
  if (!core) {
    warnings.push('No SKILL.md or root-level .md file found in the archive.');
    return { core: null, coreName: null, ignored, warnings };
  }

  if (core.originalSize > MAX_CORE_BYTES) {
    throw new ValidationError(
      `${core.name} is ${core.originalSize} bytes; a skill body is limited to ${MAX_CORE_BYTES}.`,
    );
  }

  // Pass 2 — inflate the core, and only the core.
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes, { filter: (file) => file.name === core.name });
  } catch (err) {
    throw new ValidationError(`Could not read ${core.name} from the archive: ${(err as Error).message}`);
  }
  const raw = unzipped[core.name];
  if (!raw) throw new ValidationError(`Could not read ${core.name} from the archive.`);

  return {
    core: new TextDecoder('utf-8').decode(raw),
    coreName: core.name,
    ignored,
    warnings,
  };
}
