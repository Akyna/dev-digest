import type { Agent } from "@devdigest/shared";

/** "General reviewer" (or the first agent, absent that name) is the default
    binding target — most workspaces have exactly one review agent at this
    stage of the course, and a fresh skill is useless until something reads it. */
export function defaultAgentIds(agents: Agent[]): string[] {
  if (agents.length === 0) return [];
  const general = agents.find((a) => /general/i.test(a.name));
  return [(general ?? agents[0]!).id];
}

export function canSubmit(name: string, body: string): boolean {
  return name.trim().length > 0 && body.trim().length > 0;
}
