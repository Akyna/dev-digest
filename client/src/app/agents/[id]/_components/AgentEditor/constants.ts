import type { IconName } from "@devdigest/ui";

/** Editor tab descriptor. `labelKey` resolves under the `agents` namespace. */
export interface EditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

/** Editor tabs. Config + Skills are built; Evals/Stats/CI arrive in later lessons.
    Keys must stay in sync with `VALID_TABS` in `app/agents/[id]/page.tsx`, which
    is what makes `?tab=` survive a reload. */
export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "skills", labelKey: "editor.tabs.skills", icon: "Sparkles" },
];
