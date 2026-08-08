import type { SkillSource, SkillType } from "@devdigest/shared";
import { TYPE_COLOR, UNTRUSTED_SOURCES } from "./constants";

/** Resolve the badge colour for a skill type. */
export function typeColor(type: SkillType): string {
  return TYPE_COLOR[type] ?? "var(--text-secondary)";
}

/** True when the body came from outside this workspace and still needs vetting. */
export function isUntrusted(source: SkillSource): boolean {
  return UNTRUSTED_SOURCES.includes(source);
}
