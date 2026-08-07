# client — CLAUDE.md

`@devdigest/web` — the studio. Next.js 15 App Router UI: import repos, browse
PRs, run/read AI reviews, author agents. Data via TanStack Query hooks over the
Fastify API.

## Stack

Next.js 15 (App Router) · React 19 · TanStack Query · `next-intl` (messages in
`messages/<locale>/*.json`) · `recharts` · `mermaid` · `react-markdown`. UI
primitives vendored under `src/vendor/ui` (`@devdigest/ui`); shared Zod
contracts under `src/vendor/shared` (`@devdigest/shared`).

## Commands

`pnpm dev` (:3000) · `pnpm test` (vitest + jsdom, fetch mocked — no API needed)
· `pnpm typecheck` · `pnpm build`.

## Structure

`src/app/**/page.tsx` — routes · `src/lib/hooks/*` — one hook per API resource,
calling `src/lib/api.ts` · `src/lib/repo-context.tsx` — active-repo state ·
`src/components/*` — feature components (diff-viewer, mermaid-diagram, …).

## Non-default conventions

- `NEXT_PUBLIC_API_BASE` (default `http://localhost:3001`) is the only way the client reaches the API — no server actions calling the DB directly.
- Every API call goes through a hook in `src/lib/hooks/*`; don't `fetch` ad hoc in components.

## Do-not-touch

- `src/vendor/ui`, `src/vendor/shared` — vendored, edit upstream not here.

## Read when

- UI route map / API surface diagram → `README.md`
- Design decisions, deep dives for this module → `docs/`
- Feature specs before implementing a screen → `docs/specs/`
- Gotchas discovered while working in this package → `INSIGHTS.md`
