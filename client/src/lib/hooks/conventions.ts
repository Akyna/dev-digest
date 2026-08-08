/* hooks/conventions.ts — React Query hooks for the Conventions page (L02):
   scan a cloned repo for de-facto coding conventions, accept/reject/edit each
   candidate, then draft and create a skill from the accepted set. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Skill } from "@devdigest/shared";

/** Extends the server's ConventionCandidate DTO with the L02 fields
    (category/status/evidence_line/…) — local, since @devdigest/shared is
    vendored and only carries the base contract. */
export interface ConventionCandidate {
  id: string;
  rule: string;
  evidence_path: string;
  evidence_snippet: string;
  confidence: number;
  accepted: boolean;
  category: string | null;
  evidence_line: number | null;
  evidence_end_line: number | null;
  status: "pending" | "accepted" | "rejected";
  support_count: number;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConventionsListResponse {
  candidates: ConventionCandidate[];
  last_scan_at: string | null;
}

export interface ExtractStats {
  sampled: number;
  proposed: number;
  verified: number;
  dropped: number;
}

export interface ExtractResponse {
  candidates: ConventionCandidate[];
  stats: ExtractStats;
}

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["conventions", repoId],
    queryFn: () => api.get<ConventionsListResponse>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

/** Runs the scan pipeline synchronously (the caller shows a "Scanning…"
    spinner for the duration) — `pending` candidates from a prior scan are
    replaced, `accepted`/`rejected`/edited ones are kept. */
export function useExtractConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ExtractResponse>(`/repos/${repoId}/conventions/extract`, {}),
    onSuccess: (data) => {
      qc.setQueryData(["conventions", repoId], (prev: ConventionsListResponse | undefined) => ({
        candidates: data.candidates,
        last_scan_at: prev?.last_scan_at ?? new Date().toISOString(),
      }));
      qc.invalidateQueries({ queryKey: ["conventions", repoId] });
    },
  });
}

export interface UpdateConventionInput {
  id: string;
  patch: Partial<Pick<ConventionCandidate, "status" | "rule" | "category" | "evidence_snippet">>;
}

export function useUpdateConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateConventionInput) =>
      api.patch<ConventionCandidate>(`/conventions/${id}`, patch),
    onSuccess: (updated) => {
      qc.setQueryData(["conventions", repoId], (prev: ConventionsListResponse | undefined) =>
        prev
          ? { ...prev, candidates: prev.candidates.map((c) => (c.id === updated.id ? updated : c)) }
          : prev,
      );
    },
  });
}

export interface SkillDraft {
  name: string;
  description: string;
  body: string;
}

/** Server-generated preview — nothing is written until useCreateSkillFromConventions. */
export function useSkillDraft(repoId: string | null | undefined) {
  return useMutation({
    mutationFn: (conventionIds: string[]) =>
      api.post<SkillDraft>(`/repos/${repoId}/conventions/skill-draft`, {
        convention_ids: conventionIds,
      }),
  });
}

export interface CreateSkillFromConventionsInput {
  convention_ids: string[];
  name: string;
  description?: string;
  type: "convention";
  enabled?: boolean;
  body: string;
  agent_ids?: string[];
}

export function useCreateSkillFromConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillFromConventionsInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["agent-skill-counts"] });
    },
  });
}
