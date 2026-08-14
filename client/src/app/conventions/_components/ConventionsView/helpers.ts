import type { ConventionCandidate } from "@/lib/hooks/conventions";

export function acceptedIds(candidates: ConventionCandidate[]): string[] {
  return candidates.filter((c) => c.status === "accepted").map((c) => c.id);
}
