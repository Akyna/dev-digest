import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import {
  filenameStem,
  inferSkillType,
  isContentChange,
  parseSkillMarkdown,
  skillFileKind,
  slugify,
} from '../src/modules/skills/helpers.js';
import { unzipSkillCore } from '../src/modules/skills/archive.js';
import { MAX_ARCHIVE_ENTRIES } from '../src/modules/skills/constants.js';
import { ValidationError } from '../src/platform/errors.js';

/**
 * Hermetic tests for the skill import path — no DB, no Docker. Covers the
 * frontmatter parser (inline + folded + absent) and the in-memory zip reader,
 * including the product rule that executable archive members are listed and
 * warned about but never treated as a skill.
 */

function zip(files: Record<string, string | Uint8Array>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] = typeof content === 'string' ? strToU8(content) : content;
  }
  return zipSync(entries);
}

describe('parseSkillMarkdown', () => {
  it('reads inline frontmatter scalars', () => {
    const md = [
      '---',
      'name: react-architecture',
      'description: React and Next.js file/folder architecture — decides where code lives.',
      '---',
      '',
      '# React & Next.js Architecture',
      '',
      'Where code lives, not how it is written.',
      '',
    ].join('\n');

    const parsed = parseSkillMarkdown(md, 'upload');
    expect(parsed.name).toBe('react-architecture');
    expect(parsed.description).toBe(
      'React and Next.js file/folder architecture — decides where code lives.',
    );
    // The frontmatter block itself is stripped from the body.
    expect(parsed.body.startsWith('# React & Next.js Architecture')).toBe(true);
    expect(parsed.body).not.toContain('name: react-architecture');
  });

  it('folds an indented multi-line description into one line', () => {
    const md = [
      '---',
      'name: pr-self-review',
      "description: Self-review all local changes against this repo's own skill catalog before a",
      '  pull request is opened. Use before running git push on a feature branch, before gh pr',
      '  create, when the user says "review my changes".',
      '---',
      '',
      '# PR Self Review',
      '',
      'Catch problems before a pull request is even opened.',
    ].join('\n');

    const parsed = parseSkillMarkdown(md, 'upload');
    expect(parsed.name).toBe('pr-self-review');
    expect(parsed.description).toBe(
      "Self-review all local changes against this repo's own skill catalog before a pull " +
        'request is opened. Use before running git push on a feature branch, before gh pr ' +
        'create, when the user says "review my changes".',
    );
  });

  it('supports a block scalar indicator and quoted values', () => {
    const md = ['---', 'name: "quoted-name"', 'description: >', '  first line', '  second line', '---', '', 'Body.'].join(
      '\n',
    );
    const parsed = parseSkillMarkdown(md, 'upload');
    expect(parsed.name).toBe('quoted-name');
    expect(parsed.description).toBe('first line second line');
  });

  it('derives name from the first heading and description from the first paragraph', () => {
    const md = [
      '# Naming Rules For Handlers',
      '',
      'Handlers must be named after the event they answer, never after the',
      'component that renders them.',
      '',
      '## Details',
      '',
      'More prose.',
    ].join('\n');

    const parsed = parseSkillMarkdown(md, 'fallback-name');
    expect(parsed.name).toBe('naming-rules-for-handlers');
    expect(parsed.description).toBe(
      'Handlers must be named after the event they answer, never after the component that renders them.',
    );
    // No frontmatter → body is the document verbatim.
    expect(parsed.body).toBe(md);
  });

  it('falls back to the supplied name when there is no heading', () => {
    // The service always passes the filename STEM (see filenameStem).
    const parsed = parseSkillMarkdown('just prose, no heading at all.', filenameStem('My Skill.md'));
    expect(parsed.name).toBe('my-skill');
    expect(parsed.description).toBe('just prose, no heading at all.');
  });

  it('treats an unterminated fence as body, not frontmatter', () => {
    const md = '---\nname: never-closed\n\n# Heading\n';
    const parsed = parseSkillMarkdown(md, 'upload');
    expect(parsed.body).toBe(md);
    expect(parsed.name).toBe('heading');
  });
});

describe('inferSkillType / helpers', () => {
  it('classifies by keyword and defaults to custom', () => {
    expect(inferSkillType('owasp-checks', 'Flags injection and SSRF.')).toBe('security');
    expect(inferSkillType('review-rubric', 'Scoring criteria for a diff.')).toBe('rubric');
    expect(inferSkillType('house-style', 'Naming and lint guidelines.')).toBe('convention');
    expect(inferSkillType('misc', 'Nothing recognisable here.')).toBe('custom');
  });

  it('slugify / filenameStem / skillFileKind', () => {
    expect(slugify('PR Self Review!')).toBe('pr-self-review');
    expect(filenameStem('skills/my-rule.md')).toBe('my-rule');
    expect(skillFileKind('a.MD')).toBe('md');
    expect(skillFileKind('a.zip')).toBe('zip');
    expect(skillFileKind('a.tar.gz')).toBeNull();
  });

  it('isContentChange ignores an enabled-only toggle', () => {
    expect(isContentChange({ enabled: false })).toBe(false);
    expect(isContentChange({})).toBe(false);
    expect(isContentChange({ enabled: false, body: 'new' })).toBe(true);
    expect(isContentChange({ name: 'x' })).toBe(true);
  });
});

describe('unzipSkillCore', () => {
  it('extracts SKILL.md and ignores (never runs) every other entry', () => {
    const archive = zip({
      'SKILL.md': '---\nname: packaged\ndescription: A packaged skill.\n---\n\n# Packaged\n',
      'install.sh': '#!/bin/sh\nrm -rf /\n',
      'README.md': '# Readme',
      'assets/logo.png': new Uint8Array([1, 2, 3]),
    });

    const result = unzipSkillCore(archive);
    expect(result.coreName).toBe('SKILL.md');
    expect(result.core).toContain('name: packaged');
    expect(result.ignored.sort()).toEqual(['README.md', 'assets/logo.png', 'install.sh']);
    expect(result.warnings.some((w) => w.includes('install.sh'))).toBe(true);
    expect(result.warnings.join(' ')).toContain('never runs archive contents');
    // The parser only ever sees the core.
    expect(parseSkillMarkdown(result.core!, 'packaged.zip').name).toBe('packaged');
  });

  it('prefers the shallowest SKILL.md', () => {
    const result = unzipSkillCore(
      zip({
        'deep/nested/SKILL.md': '# deep',
        'top/SKILL.md': '# top',
      }),
    );
    expect(result.coreName).toBe('top/SKILL.md');
    expect(result.ignored).toEqual(['deep/nested/SKILL.md']);
  });

  it('falls back to the first root-level .md when there is no SKILL.md', () => {
    const result = unzipSkillCore(zip({ 'guide.md': '# guide', 'nested/other.md': '# other' }));
    expect(result.coreName).toBe('guide.md');
    expect(result.ignored).toEqual(['nested/other.md']);
  });

  it('returns core: null and a warning when the archive holds no markdown', () => {
    const result = unzipSkillCore(zip({ 'run.py': 'print(1)' }));
    expect(result.core).toBeNull();
    expect(result.coreName).toBeNull();
    expect(result.ignored).toEqual(['run.py']);
    expect(result.warnings.join(' ')).toContain('No SKILL.md');
  });

  it('ignores and warns about traversal / absolute paths', () => {
    const result = unzipSkillCore(
      zip({ 'SKILL.md': '# ok', '../escape.md': 'nope', '/etc/passwd': 'nope' }),
    );
    expect(result.coreName).toBe('SKILL.md');
    expect(result.ignored.sort()).toEqual(['../escape.md', '/etc/passwd']);
    expect(result.warnings.join(' ')).toContain('unsafe paths');
  });

  it('rejects an archive with too many entries', () => {
    const files: Record<string, string> = { 'SKILL.md': '# ok' };
    for (let i = 0; i < MAX_ARCHIVE_ENTRIES; i += 1) files[`f${i}.txt`] = 'x';
    expect(() => unzipSkillCore(zip(files))).toThrow(ValidationError);
    expect(() => unzipSkillCore(zip(files))).toThrow(/limit is 200/);
  });

  it('rejects an archive that expands past the total-size cap (zip bomb)', () => {
    // 6 MB of zeros compresses to a few KB — exactly the shape of a zip bomb.
    const bomb = zip({ 'SKILL.md': '# ok', 'payload.bin': new Uint8Array(6 * 1024 * 1024) });
    expect(() => unzipSkillCore(bomb)).toThrow(/limit is 5242880/);
  });

  it('rejects an oversized skill core', () => {
    const huge = zip({ 'SKILL.md': `# big\n${'a'.repeat(300 * 1024)}` });
    expect(() => unzipSkillCore(huge)).toThrow(/limited to 262144/);
  });

  it('rejects data that is not a zip at all', () => {
    expect(() => unzipSkillCore(strToU8('not a zip'))).toThrow(ValidationError);
  });
});
