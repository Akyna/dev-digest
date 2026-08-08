import { z } from 'zod';
import type { SampledFile } from './sampling.js';

/**
 * Step 1 schema — the model sees only paths (+ a size hint) and picks which
 * ones are worth reading in full. Keeps step 2's token budget on the files
 * most likely to carry conventions instead of every sampled file verbatim.
 */
export const ConventionFileSelection = z.object({
  paths: z
    .array(z.string().describe('One of the offered sample paths, verbatim.'))
    .describe('Paths worth reading in full to extract coding conventions from.'),
});
export type ConventionFileSelection = z.infer<typeof ConventionFileSelection>;

/**
 * Step 2 schema — one candidate per de-facto convention the model can point at
 * a concrete line for. `evidence_line` is 1-indexed against the numbered
 * source shown in the prompt; verify.ts re-checks (and can correct) it against
 * the real file content, so a slightly-off line here is not fatal.
 */
export const ConventionCandidateProposal = z.object({
  category: z
    .string()
    .describe('Short grouping label, e.g. naming, error-handling, structure, testing, api.'),
  rule: z.string().describe('One sentence, imperative, stating the convention.'),
  evidence_path: z.string().describe('Path of the file this rule was observed in, verbatim.'),
  evidence_line: z.number().int().min(1).describe('1-indexed line number where the pattern appears.'),
  evidence_snippet: z
    .string()
    .describe('The exact source line(s) at evidence_line, copied verbatim — not paraphrased.'),
  confidence: z.number().min(0).max(1).describe('How consistently this pattern holds across the sample.'),
});
export type ConventionCandidateProposal = z.infer<typeof ConventionCandidateProposal>;

export const ConventionExtraction = z.object({
  candidates: z.array(ConventionCandidateProposal),
});
export type ConventionExtraction = z.infer<typeof ConventionExtraction>;

const SYSTEM = `You extract de-facto coding conventions from a cloned repository's own
source, for a code-review skill. A convention is a PATTERN THE REPO ACTUALLY
FOLLOWS, not a generic best practice — every rule you propose must be
grounded in a literal line you can quote. Never invent a file, a line number,
or a snippet: if you cannot point at real source text, drop the rule instead
of guessing. Judgment goes in the rule text; the JSON schema constrains only
its shape.`;

export function fileSelectionMessages(paths: string[]) {
  return [
    { role: 'system' as const, content: SYSTEM },
    {
      role: 'user' as const,
      content: [
        'Below are candidate file paths sampled from the repository (configs + top-ranked source files).',
        'Pick the subset worth reading in full to extract coding conventions from — prefer files that show naming, error-handling, structure, testing or API patterns over one-off scripts.',
        '',
        paths.map((p) => `- ${p}`).join('\n'),
      ].join('\n'),
    },
  ];
}

function numberedSource(file: SampledFile): string {
  return file.content
    .split('\n')
    .map((line, i) => `${i + 1}\t${line}`)
    .join('\n');
}

export function extractionMessages(files: SampledFile[], signalsDigest: string) {
  const body = files
    .map((f) => `### ${f.path}\n\`\`\`\n${numberedSource(f)}\n\`\`\``)
    .join('\n\n');

  return [
    { role: 'system' as const, content: SYSTEM },
    {
      role: 'user' as const,
      content: [
        'Config-derived conventions already known (do not repeat these):',
        signalsDigest,
        '',
        'Extract additional de-facto conventions from the numbered source below.',
        'For each, `evidence_line` MUST be a line number shown here and `evidence_snippet` MUST be copied verbatim from that line.',
        '',
        body,
      ].join('\n'),
    },
  ];
}
