---
name: react-architecture
description: React and Next.js file/folder architecture — decides where a component, constant, helper, or business-logic function should physically live, the canonical per-component folder shape, and when shared code should be promoted to an app-wide layer. Use this whenever creating a new component or route, moving or refactoring files, reviewing file/folder organization in a diff, or when the user asks "where should this go", mentions folder structure, colocation, feature-based architecture, or where constants/utils/helpers/business logic belong — even if they don't name this skill explicitly. Defers component-internal rules (props, hooks, performance) to react-best-practices, and Next.js routing/rendering mechanics to next-best-practices.
---

# React & Next.js Architecture

Where code lives, not how it's written. Bad placement is what turns a
codebase into a graveyard of orphaned `utils.ts` files nobody dares delete
and duplicate helpers reinvented in three components — this skill exists to
make that decision mechanical instead of a judgment call made fresh each
time. For sourcing and rationale, see [references.md](references.md). For
before/after trees, see [examples.md](examples.md).

## Core principle: colocate, escalate only on reuse

Place code as close as possible to the single place that uses it. Move it
up a level **only when a second, unrelated consumer needs it** — never in
anticipation of reuse. This is the "rule of two": one consumer stays local,
two consumers justifies promotion, zero consumers means delete it.

Promoting on the first use, "just in case," is how a repo ends up with a
`src/lib/utils.ts` that imports from everywhere and is owned by no one —
every escalation should be traceable to an actual second caller, not a
guess about the future.

## Decision table — where does this go?

| You're adding... | One consumer | Shared by 2+ things in one route | Shared across 2+ routes |
|---|---|---|---|
| A component | route's `_components/ComponentName/` | route's `_components/ComponentName/` (still route-local) | `src/components/ComponentName/` |
| A pure helper function | component's `helpers.ts` | route-level `helpers.ts` | `src/lib/*.ts` |
| A constant | component's `constants.ts` | route-level `constants.ts` | `src/lib/*.ts` (rare — prefer keeping constants near their usage) |
| Style values | component's `styles.ts` | route-level `styles.ts` | n/a — style values don't cross routes |
| Data fetching / mutation | — | — | always `src/lib/hooks/*`, one file per API resource |

There is deliberately no top-level `constants/` or `utils/` catch-all
folder. If you're about to create one, you're skipping the escalation rule —
put the code at the narrowest scope above instead.

## Canonical per-component folder shape

Every component — route-local or shared — follows the same six-file shape:

```
ComponentName/
  ComponentName.tsx       # the component itself
  index.ts                # re-export: export { ComponentName, ComponentName as default } from "./ComponentName"
  constants.ts             # component-local constants
  helpers.ts               # component-local pure functions
  styles.ts                 # co-located style objects (satisfies CSSProperties)
  ComponentName.test.tsx   # co-located test
```

Not every file is required — a trivial component may skip `constants.ts` or
`styles.ts` — but when one of these concerns exists, it goes in its own file
at this location, never inlined into `ComponentName.tsx` and never hoisted to
a shared file on its first use.

## Where components physically live

- **Route-local** (used by exactly one route): `_components/` next to the
  route, e.g. `src/app/agents/_components/AgentCard/`. Next.js private
  folders (`_name`) are colocation-safe by default — they're never routable.
- **Shared across routes**: `src/components/` (e.g. `app-shell`,
  `diff-viewer`, `page-shell`).
- **Vendored UI kit / contracts**: `src/vendor/ui`, `src/vendor/shared` —
  do-not-touch, edit at source per the root `CLAUDE.md`, not part of this
  app's own organizational decisions.

## Business logic placement

- **Pure logic** (calculations, formatting, derivations) → `helpers.ts` at
  the narrowest scope from the decision table above. Extracted outside the
  component body, imported in.
- **Stateful / data-fetching logic** → a hook. This app has **no separate
  `services/` layer** — `src/lib/hooks/*` calls the single `src/lib/api.ts`
  client directly. One hook file per API resource (`agents.ts`,
  `reviews.ts`, `repo-intel.ts`, ...). Don't `fetch` ad hoc in a component:
  every request needs to go through the one client so auth headers, error
  shape, and cancellation stay consistent, and so there's exactly one place
  to look when a request misbehaves.
- **Cross-cutting app state** (auth-like context, theme, toasts) →
  `src/lib/*.tsx` providers, not component-local state.

`src/lib/` is the *only* app-wide layer. Something belongs there only once
2+ route trees need it — otherwise it stays colocated per the table above.

## Feature-based vs technical-layer structure

Grouping files by technical type (`components/`, `hooks/`, `utils/` at the
project root) breaks down as an app grows: unrelated features' files
interleave, and deleting a feature means hunting across folders. The
industry has converged on grouping by feature/domain instead (bulletproof-react,
Feature-Sliced Design) — see [references.md](references.md).

This repo doesn't need an explicit `features/` folder because **Next.js's
own route segments already provide that boundary**: each `app/<route>/`
directory plus its `_components/` is a feature slice by construction. Only
truly cross-cutting code escalates to `src/components/` or `src/lib/`.

## Atomic design — narrow use only

Atomic design (atoms/molecules/organisms) works for a shared, reusable UI
kit — this repo's equivalent is the vendored `src/vendor/ui`. It does **not**
apply to feature components: don't classify `AgentCard` as an "organism" or
split it into atoms it doesn't share with anything else. Feature components
follow the per-component folder shape above, not an atomic taxonomy.

## Related skills

- [react-best-practices](../react-best-practices/SKILL.md) — component
  internals: props, hooks, state, performance, anti-patterns.
- [next-best-practices](../next-best-practices/SKILL.md) — Next.js routing
  and rendering mechanics (RSC boundaries, route handlers, metadata).
