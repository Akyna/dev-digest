import type { SkillType } from "@devdigest/shared";

/** Badge palette per skill type, reusing the app's semantic tokens so a
    security skill reads as "security" without needing a legend. */
export const SKILL_TYPE_COLOR: Record<SkillType, { color: string; bg: string }> = {
  rubric: { color: "var(--ok)", bg: "var(--ok-bg)" },
  convention: { color: "var(--accent-text)", bg: "var(--accent-bg)" },
  security: { color: "var(--crit)", bg: "var(--crit-bg)" },
  custom: { color: "var(--info)", bg: "var(--info-bg)" },
};

/** Where the Skills page lives — the empty state and the "re-enable it" hint
    both send the user here, because neither is fixable from this tab. */
export const SKILLS_HREF = "/skills";
