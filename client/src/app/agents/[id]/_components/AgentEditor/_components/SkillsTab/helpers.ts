import type { AgentSkillLink, Skill } from "@devdigest/shared";

/** The agent's linked skill ids, lowest `order` first.
    This list IS the prompt block order — never sort it any other way. */
export function linkedSkillIds(links: AgentSkillLink[] | undefined | null): string[] {
  return [...(links ?? [])].sort((a, b) => a.order - b.order).map((l) => l.skill_id);
}

/** Case-insensitive match over the fields the row actually shows, so filtering
    never hides a row for a reason the user can't see. */
export function matchesFilter(skill: Skill, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    skill.name.toLowerCase().includes(needle) ||
    skill.description.toLowerCase().includes(needle) ||
    skill.type.toLowerCase().includes(needle) ||
    skill.source.toLowerCase().includes(needle)
  );
}

/**
 * Split the workspace skills into the attached ones (in prompt order) and the
 * rest (alphabetical).
 *
 * An attached id with no matching skill is dropped: a link can outlive the
 * skill it points at, and rendering a ghost row would be worse than silently
 * healing the list on the next save.
 */
export function splitSkills(
  skills: Skill[],
  attachedIds: string[],
): { attached: Skill[]; available: Skill[] } {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  const attached = attachedIds.map((id) => byId.get(id)).filter((sk): sk is Skill => !!sk);
  const attachedIdSet = new Set(attached.map((sk) => sk.id));
  const available = skills
    .filter((sk) => !attachedIdSet.has(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { attached, available };
}

/** Swap the id at `index` with its neighbour `delta` away. Out-of-range moves
    return the original array so the caller's dirty check stays honest. */
export function moveId(ids: string[], index: number, delta: number): string[] {
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  // Both reads are in range thanks to the guard above, but
  // `noUncheckedIndexedAccess` widens them to `string | undefined` — pin them to
  // locals so the swap stays a `string[]` instead of `(string | undefined)[]`.
  const a = next[index]!;
  const b = next[target]!;
  next[index] = b;
  next[target] = a;
  return next;
}

/** Equal only if the ORDER matches too — order is half the payload here. */
export function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
