# reviewer-core — CLAUDE.md

`@devdigest/reviewer-core` — the review engine. Pure logic: **diff → prompt →
LLM → grounded findings**. No database, GitHub, or filesystem access; the only
side effect is an LLM call through an **injected** `LLMProvider`, which is what
makes it mock-testable.

## Stack

TypeScript, consumed as **source** by the server via a tsconfig path alias
(`@devdigest/reviewer-core` → `../reviewer-core/src`) — no build step, `build`
is a type-check only. Contracts (`Review`, `Finding`, `Verdict`, …) come from
`@devdigest/shared`.

## Commands

`pnpm test` (vitest, hermetic — stubbed `LLMProvider`, no keys/network) ·
`pnpm typecheck` (doubles as build).

## Structure

`src/prompt.ts` — `assemblePrompt()` / `wrapUntrusted()` (injection fencing) ·
`src/llm/` — `openrouter.ts` (provider), `structured.ts` (Zod → JSON Schema,
parse-with-repair) · `src/grounding.ts` — `groundFindings()`, the mandatory
citation gate vs the diff · `src/review/run.ts` — orchestrates a run.

## Non-default conventions

- The grounding gate is mandatory: a finding that doesn't cite a real diff line is dropped — the score is recomputed from **surviving** findings only, never trusted from the model.
- Extra prompt slots (`skills`, `memory`, `specs`, `callers`) exist for later course lessons; the starter server passes only diff + system prompt + repo map — `assemblePrompt` omits the rest.

## Do-not-touch

- Nothing vendored here — this package has no `vendor/` dir.

## Read when

- Pipeline diagram, public API, testing detail → `README.md`
- Design decisions, deep dives for this module → `docs/`
- Feature specs before extending the pipeline → `docs/specs/`
- Gotchas discovered while working in this package → `INSIGHTS.md`
