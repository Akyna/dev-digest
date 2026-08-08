/** Constants for SkillCard. */

import type { SkillSource, SkillType } from "@devdigest/shared";

/** Skill type → badge colour. */
export const TYPE_COLOR: Record<SkillType, string> = {
  rubric: "#3b82f6",
  convention: "#8b5cf6",
  security: "#ef4444",
  custom: "#10b981",
};

/** Sources whose body is someone else's text and must be vetted before enabling. */
export const UNTRUSTED_SOURCES: readonly SkillSource[] = ["imported_url", "community"];
