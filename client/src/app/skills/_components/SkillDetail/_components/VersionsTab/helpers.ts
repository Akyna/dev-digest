import type { SkillVersion } from "@/lib/hooks/skills";

/** Newest version first. Does not mutate the query cache's array. */
export function newestFirst(versions: readonly SkillVersion[]): SkillVersion[] {
  return [...versions].sort((a, b) => b.version - a.version);
}

/** `created_at` as a short local timestamp; falls back to the raw string. */
export function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** First line of a body, trimmed, as a one-glance label for a version row. */
export function bodyHeadline(body: string, max = 90): string {
  const first = body.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  return first.length > max ? first.slice(0, max) + "…" : first;
}
