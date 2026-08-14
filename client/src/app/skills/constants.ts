/* Route-level constants for /skills — the things more than one component in
   this route needs. Per `react-architecture`, a component folder's own
   `constants.ts` is that component's private scope; once a sibling needs the
   same value it belongs here instead of being imported sideways. */

import type { IconName } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";

/** The four skill types, offered by both the create modal and the config tab.

    Listed literally rather than read off the shared Zod enum on purpose:
    `@devdigest/shared` is a TYPE-only dependency on the client (its barrel
    re-exports with `.js` specifiers that webpack cannot resolve), so importing
    the schema as a value breaks `next build`. The `satisfies` clause still
    fails the build if the contract's union ever changes. */
export const SKILL_TYPE_VALUES = [
  "rubric",
  "convention",
  "security",
  "custom",
] as const satisfies readonly SkillType[];

/** Detail tab descriptor. `labelKey` resolves under the `skills` namespace. */
export interface SkillTab {
  key: string;
  labelKey: string;
  icon: IconName;
  /** Placeholder tabs render an EmptyState instead of a real body. */
  placeholder?: boolean;
}

/** Tabs of the skill detail pane. `evals` lands in a later lesson — scoring a
    skill against a fixture set needs an eval harness that doesn't exist yet.
    `stats` is real: version count and linked-agents come straight off tables
    this lesson already owns (`skills.version`, `agent_skills`). Pull
    frequency / accept rate / findings-by-category would need a `skill_id` on
    findings and usage-event tracking that don't exist — that part is still a
    later lesson, scoped out of `StatsTab` itself rather than the whole tab.
    Shared: SkillDetail renders them, SkillsListView validates `?tab=` against
    them before it ever mounts SkillDetail. */
export const TABS: readonly SkillTab[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
  { key: "versions", labelKey: "detail.tabs.versions", icon: "History" },
  { key: "evals", labelKey: "detail.tabs.evals", icon: "FlaskConical", placeholder: true },
  { key: "stats", labelKey: "detail.tabs.stats", icon: "BarChart" },
];

/** Tab keys accepted from `?tab=`; anything else falls back to DEFAULT_TAB. */
export const VALID_TABS: readonly string[] = TABS.map((t) => t.key);

export const DEFAULT_TAB = "config";
