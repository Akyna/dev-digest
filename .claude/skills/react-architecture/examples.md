# Examples

## The real thing: `AgentCard`

`src/app/agents/_components/AgentCard/` — a route-local component using the
full six-file shape:

```
AgentCard/
  AgentCard.tsx       # renders the card
  index.ts            # export { AgentCard, AgentCard as default } from "./AgentCard";
  constants.ts         # MODEL_COLOR: Record<string, string>
  helpers.ts           # modelColor(model) -> MODEL_COLOR[model] ?? "var(--text-secondary)"
  styles.ts             # co-located CSSProperties objects
  AgentCard.test.tsx   # co-located test
```

`helpers.ts` imports from the sibling `constants.ts` — both stay inside the
component folder because nothing else uses them yet.

## Bad: technical-layer structure

```
src/
  components/
    AgentCard.tsx
  hooks/
    useAgentCard.ts
  utils/
    modelColor.ts
  constants/
    modelColors.ts
  styles/
    agentCardStyles.ts
```

Everything one component needs is scattered across five top-level folders.
Deleting or renaming `AgentCard` means hunting through all five. Nothing
here signals "these files belong together" except a shared name fragment.

## Good: colocated (what this repo does)

```
src/app/agents/_components/AgentCard/
  AgentCard.tsx
  index.ts
  constants.ts
  helpers.ts
  styles.ts
  AgentCard.test.tsx
```

One folder, one deletion, one mental model.

## Worked example: the escalation rule in motion

Say `formatReviewScore()` starts as a helper for a single component.

**Step 1 — one consumer.** Lives in that component's own file:

```
src/app/repos/[repoId]/pulls/_components/PRRow/helpers.ts
  export function formatReviewScore(score: number): string { ... }
```

**Step 2 — a second component in the same route needs it** (e.g.
`FilterBar` also wants to format a score). Promote to the route level, not
directly to `src/lib/`:

```
src/app/repos/[repoId]/pulls/helpers.ts
  export function formatReviewScore(score: number): string { ... }
```

Both `PRRow` and `FilterBar` import from the route-level `helpers.ts`.

**Step 3 — a second, unrelated route needs it** (e.g. the agents page also
wants to show a formatted score). Only now does it escalate to the app-wide
layer:

```
src/lib/format-cost.ts   # or a new src/lib/format-score.ts
  export function formatReviewScore(score: number): string { ... }
```

Skipping straight from step 1 to step 3 "just in case" is the mistake this
rule prevents — it's how a repo ends up with a single bloated `src/lib/utils.ts`
that everything imports from and nothing owns.
