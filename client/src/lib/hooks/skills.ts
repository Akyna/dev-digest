/* hooks/skills.ts — React Query hooks for the Skills page, the skill editor,
   and the Skills tab of the Agent editor.

   A skill is pure configuration text: name + description + markdown body. It is
   never executed — it only becomes a block in the assembled review prompt. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { AgentSkillLink, Skill, SkillType } from "@devdigest/shared";

/** One historical body snapshot of a skill (`skill_versions` row). */
export interface SkillVersion {
  skill_id: string;
  version: number;
  body: string;
  created_at: string;
}

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  /** Defaults to 'manual' server-side; the import flow passes 'imported_url'. */
  source?: Skill["source"];
  enabled?: boolean;
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: Partial<Pick<Skill, "name" | "description" | "type" | "body" | "enabled">>;
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
      // Deleting a skill cascades to `agent_skills` server-side, so any cached
      // link list or count still naming it is stale. Without these, an agent's
      // Skills tab keeps a ghost id in its draft and the card badge over-counts.
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
      qc.invalidateQueries({ queryKey: ["agent-skill-counts"] });
    },
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

/** What the Stats tab shows — versions is `skill.version`, agents is who
    currently pulls this skill into their prompt. */
export interface SkillStats {
  skill_id: string;
  versions: number;
  agents_linked: number;
  agents: Array<{ id: string; name: string }>;
}

export function useSkillStats(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-stats", id],
    queryFn: () => api.get<SkillStats>(`/skills/${id}/stats`),
    enabled: !!id,
  });
}

/** Restoring an old body is a normal edit — it produces a NEW version, never
    rewrites history. */
export function useRestoreSkillVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post<Skill>(`/skills/${id}/restore/${version}`, {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

// ---- Import ---------------------------------------------------------------

/** What the server extracted from an uploaded file — NOT yet persisted. */
export interface SkillImportPreview {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  /** Archive entries deliberately left alone (never unpacked, never executed). */
  ignored_files: string[];
  /** Human-readable notes, e.g. "the archive contains executable files". */
  warnings: string[];
}

export interface ImportSkillInput {
  filename: string;
  /** Raw text for a .md upload. */
  content?: string;
  /** Base64 for a .zip upload. */
  content_b64?: string;
}

/** Preview only — nothing is written until the user confirms with useCreateSkill. */
export function useImportSkillPreview() {
  return useMutation({
    mutationFn: (input: ImportSkillInput) =>
      api.post<SkillImportPreview>("/skills/import/preview", input),
  });
}

// ---- Agent ⇄ skill links --------------------------------------------------

export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", agentId],
    queryFn: () => api.get<AgentSkillLink[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

/** `{ [agentId]: linkedSkillCount }` for the whole workspace in one request.
    Agents with no linked skills are absent from the map, not zero — callers
    default them. Exists so the agents list can badge every card without firing
    a request per card. */
export function useAgentSkillCounts() {
  return useQuery({
    queryKey: ["agent-skill-counts"],
    queryFn: () => api.get<Record<string, number>>("/agents/skill-counts"),
  });
}

/** Replaces the agent's whole ordered set. Array order becomes prompt order. */
export function useSetAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillIds }: { agentId: string; skillIds: string[] }) =>
      api.post<AgentSkillLink[]>(`/agents/${agentId}/skills`, { skill_ids: skillIds }),
    onSuccess: (_d, { agentId }) => {
      qc.invalidateQueries({ queryKey: ["agent-skills", agentId] });
      qc.invalidateQueries({ queryKey: ["agent-skill-counts"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
