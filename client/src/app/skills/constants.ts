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

/** Tabs of the skill detail pane. `evals`/`stats` land in a later lesson.
    Shared: SkillDetail renders them, SkillsListView validates `?tab=` against
    them before it ever mounts SkillDetail. */
export const TABS: readonly SkillTab[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
  { key: "versions", labelKey: "detail.tabs.versions", icon: "History" },
  { key: "evals", labelKey: "detail.tabs.evals", icon: "FlaskConical", placeholder: true },
  { key: "stats", labelKey: "detail.tabs.stats", icon: "BarChart", placeholder: true },
];

/** Tab keys accepted from `?tab=`; anything else falls back to DEFAULT_TAB. */
export const VALID_TABS: readonly string[] = TABS.map((t) => t.key);

export const DEFAULT_TAB = "config";
