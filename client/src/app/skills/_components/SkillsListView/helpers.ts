import type { Skill } from "@devdigest/shared";
import { DEFAULT_TAB, VALID_TABS } from "../../constants";

/** Case-insensitive filter over a skill's name + description. */
export function filterSkills(skills: Skill[], search: string): Skill[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((sk) => `${sk.name} ${sk.description}`.toLowerCase().includes(q));
}

/** `?tab=` is hand-editable, so an unknown tab must not blank the detail pane. */
export function resolveTab(raw: string | null | undefined): string {
  return raw && VALID_TABS.includes(raw) ? raw : DEFAULT_TAB;
}

/** Resolve `?skill=` against the loaded list — a deleted/stale id selects nothing. */
export function findSelected(skills: Skill[], id: string | null): Skill | undefined {
  if (!id) return undefined;
  return skills.find((sk) => sk.id === id);
}
