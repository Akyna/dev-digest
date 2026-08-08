import type { SampledFile } from './sampling.js';

/** A convention derived deterministically from config parsing — no model call,
    confidence 1.0 (it's not an inference, it's the repo's own declared rule). */
export interface ConventionSignal {
  category: string;
  rule: string;
  evidence_path: string;
  evidence_line: number;
  evidence_snippet: string;
  confidence: number;
  support_count: number;
}

function findLine(content: string, needle: string): number {
  const lines = content.split('\n');
  const idx = lines.findIndex((l) => l.includes(needle));
  return idx === -1 ? 1 : idx + 1;
}

function snippetAt(content: string, line: number): string {
  return content.split('\n')[line - 1]?.trim() ?? '';
}

/**
 * Parse the well-known config files for rules the repo has already declared
 * explicitly, so the model doesn't have to "discover" them and so the UI shows
 * a few zero-risk, maximum-confidence cards before any LLM call resolves.
 *
 * Deliberately narrow: only rules with an unambiguous, quotable `file:line` —
 * anything requiring judgment (e.g. "is this eslint rule actually followed in
 * practice") is left to the model + verify.ts pass.
 */
export function extractSignals(files: SampledFile[]): ConventionSignal[] {
  const out: ConventionSignal[] = [];

  for (const file of files) {
    const base = file.path.split('/').pop() ?? file.path;

    if (base === 'tsconfig.json') {
      try {
        const json = JSON.parse(file.content);
        const co = json.compilerOptions ?? {};
        if (co.strict === true) {
          const line = findLine(file.content, '"strict"');
          out.push({
            category: 'type-safety',
            rule: 'TypeScript strict mode is enabled — avoid `any` and unchecked nulls.',
            evidence_path: file.path,
            evidence_line: line,
            evidence_snippet: snippetAt(file.content, line),
            confidence: 1,
            support_count: 1,
          });
        }
        if (co.paths && Object.keys(co.paths).length > 0) {
          const line = findLine(file.content, '"paths"');
          out.push({
            category: 'structure',
            rule: 'Imports use tsconfig path aliases rather than long relative paths.',
            evidence_path: file.path,
            evidence_line: line,
            evidence_snippet: snippetAt(file.content, line),
            confidence: 1,
            support_count: 1,
          });
        }
      } catch {
        // malformed tsconfig — skip, this is a signal pass, not a validator
      }
    }

    if (base === 'package.json') {
      try {
        const json = JSON.parse(file.content);
        const pm = json.packageManager as string | undefined;
        if (pm) {
          const line = findLine(file.content, '"packageManager"');
          out.push({
            category: 'tooling',
            rule: `Package manager is pinned to \`${pm}\` — do not use a different one.`,
            evidence_path: file.path,
            evidence_line: line,
            evidence_snippet: snippetAt(file.content, line),
            confidence: 1,
            support_count: 1,
          });
        }
        const scripts = json.scripts ?? {};
        if (scripts.test && /vitest/.test(String(scripts.test))) {
          const line = findLine(file.content, '"test"');
          out.push({
            category: 'testing',
            rule: 'Tests run on Vitest.',
            evidence_path: file.path,
            evidence_line: line,
            evidence_snippet: snippetAt(file.content, line),
            confidence: 1,
            support_count: 1,
          });
        }
      } catch {
        // malformed package.json — skip
      }
    }

    if (base === '.prettierrc' || base.startsWith('.prettierrc.')) {
      try {
        const json = JSON.parse(file.content);
        if (json.semi === false) {
          const line = findLine(file.content, '"semi"');
          out.push({
            category: 'formatting',
            rule: 'Prettier is configured with `semi: false` — no trailing semicolons.',
            evidence_path: file.path,
            evidence_line: line,
            evidence_snippet: snippetAt(file.content, line),
            confidence: 1,
            support_count: 1,
          });
        }
        if (json.singleQuote === true) {
          const line = findLine(file.content, '"singleQuote"');
          out.push({
            category: 'formatting',
            rule: 'Prettier is configured with `singleQuote: true` — use single quotes.',
            evidence_path: file.path,
            evidence_line: line,
            evidence_snippet: snippetAt(file.content, line),
            confidence: 1,
            support_count: 1,
          });
        }
      } catch {
        // non-JSON prettier config (js/yaml) — out of scope for this pass
      }
    }

    if (base === '.editorconfig' && /indent_style\s*=\s*space/.test(file.content)) {
      const line = findLine(file.content, 'indent_style');
      out.push({
        category: 'formatting',
        rule: 'Indentation uses spaces, not tabs (`.editorconfig`).',
        evidence_path: file.path,
        evidence_line: line,
        evidence_snippet: snippetAt(file.content, line),
        confidence: 1,
        support_count: 1,
      });
    }
  }

  return out;
}

/** Short digest of the config-derived signals for the model prompt, so it
    doesn't waste a proposal "rediscovering" a rule already declared in a
    config file — the pipeline already emitted it deterministically above. */
export function signalsDigest(signals: ConventionSignal[]): string {
  if (signals.length === 0) return '(none)';
  return signals.map((s) => `- ${s.rule} (${s.evidence_path}:${s.evidence_line})`).join('\n');
}
