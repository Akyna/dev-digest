/**
 * Rough token estimate for prompt-budget display. Mirrors the server's
 * `approxTokens` fallback in `src/adapters/tokenizer/index.ts` — deliberately
 * an estimate, always rendered with a `≈` so it is never read as exact.
 *
 * The server has a real tokenizer (js-tiktoken `cl100k_base`) but its counts
 * never reach the client per prompt block; the trace contract only carries the
 * whole-run `tokens_in`/`tokens_out`. So per-block numbers here are the same
 * `ceil(chars / 4)` heuristic the server falls back to — close enough to show
 * which block dominates the budget, never close enough to bill against.
 */
export function approxTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
