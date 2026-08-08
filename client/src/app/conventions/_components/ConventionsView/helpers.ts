import type { ConventionCandidate } from "@/lib/hooks/conventions";

/** Un-rejected candidates the "select all" / bulk actions operate over — a
    rejected card stays visible (so the verdict is reviewable) but is excluded
    from bulk selection and skill drafts by default. */
export function selectableCandidates(candidates: ConventionCandidate[]): ConventionCandidate[] {
  return candidates.filter((c) => c.status !== "rejected");
}

export function acceptedIds(candidates: ConventionCandidate[]): string[] {
  return candidates.filter((c) => c.status === "accepted").map((c) => c.id);
}
