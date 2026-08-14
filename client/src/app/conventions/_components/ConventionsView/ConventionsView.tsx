/* /conventions — scan the active repo's clone for de-facto coding conventions,
   review each candidate (accept/reject/edit inline), then turn the accepted
   set into a Skill. Every candidate the list shows already survived the
   server's verify.ts grounding pass — this view only renders judgment calls,
   never "does this evidence exist" calls. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { useActiveRepo } from "@/lib/repo-context";
import {
  useConventions,
  useExtractConventions,
  useUpdateConvention,
  type ConventionCandidate,
} from "@/lib/hooks/conventions";
import { useToast } from "@/lib/toast";
import { AppShell } from "@/components/app-shell";
import { ConventionCard } from "./_components/ConventionCard";
import { CreateSkillFromConventionsModal } from "./_components/CreateSkillFromConventionsModal";
import { acceptedIds } from "./helpers";
import { SKELETON_COUNT, SKELETON_HEIGHT } from "./constants";
import { s } from "./styles";

export function ConventionsView() {
  const t = useTranslations("conventions");
  const toast = useToast();
  const { activeRepo } = useActiveRepo();
  const repoId = activeRepo?.id ?? null;

  const { data, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const [creatingSkill, setCreatingSkill] = React.useState(false);

  const allCandidates: ConventionCandidate[] = data?.candidates ?? [];
  // A rejected candidate leaves the list entirely (not just muted) — the only
  // way back is a fresh scan. `visible` is what the header count, the list,
  // and the empty-state all key off.
  const candidates = allCandidates.filter((c) => c.status !== "rejected");
  const accepted = acceptedIds(candidates);
  const pendingIds = candidates.filter((c) => c.status === "pending").map((c) => c.id);

  const runExtraction = () =>
    extract.mutate(undefined, {
      onSuccess: (res) =>
        toast.success(t("page.scanDoneToast", { count: res.stats.verified, dropped: res.stats.dropped })),
      onError: () => toast.error(t("page.extractionFailed")),
    });

  const acceptAllPending = async () => {
    for (const id of pendingIds) {
      // eslint-disable-next-line no-await-in-loop -- sequential PATCHes, small N
      await update.mutateAsync({ id, patch: { status: "accepted" } });
    }
  };

  if (!repoId) {
    return (
      <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}>
        <div style={s.page}>
          <EmptyState icon="ListChecks" title={t("page.noRepo.title")} body={t("page.noRepo.body")} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}>
      {creatingSkill && (
        <CreateSkillFromConventionsModal
          repoId={repoId}
          repoName={activeRepo?.name ?? t("page.repoFallback")}
          conventionIds={accepted}
          onClose={() => setCreatingSkill(false)}
        />
      )}

      <div style={s.page}>
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>
              {t("page.headingPrefix")}
              <code>{activeRepo?.full_name ?? t("page.repoFallback")}</code>
            </h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
          </div>
          <div style={s.headerActions}>
            <Button
              kind="secondary"
              icon="RefreshCw"
              onClick={runExtraction}
              disabled={extract.isPending}
              loading={extract.isPending}
            >
              {extract.isPending ? t("page.scanning") : data ? t("page.rescan") : t("page.runExtraction")}
            </Button>
            <Button
              kind="primary"
              icon="Sparkles"
              onClick={() => setCreatingSkill(true)}
              disabled={accepted.length === 0}
            >
              {t("page.createSkill", { count: accepted.length })}
            </Button>
          </div>
        </div>

        {data && candidates.length > 0 && (
          <div style={s.metaRow}>
            <span>{t("page.acceptedOfTotal", { accepted: accepted.length, total: candidates.length })}</span>
            {data.last_scan_at && (
              <span>{t("page.lastScan", { date: new Date(data.last_scan_at).toLocaleString() })}</span>
            )}
          </div>
        )}

        {pendingIds.length > 0 && (
          <div style={s.toolbar}>
            <Button kind="tertiary" size="sm" icon="Check" onClick={() => void acceptAllPending()}>
              {t("page.acceptAllPending", { count: pendingIds.length })}
            </Button>
          </div>
        )}

        {isLoading && (
          <div style={s.skeletons}>
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <Skeleton key={i} height={SKELETON_HEIGHT} />
            ))}
          </div>
        )}

        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}

        {!isLoading && !isError && candidates.length === 0 && (
          <EmptyState
            icon="ListChecks"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={runExtraction}
          />
        )}

        {candidates.length > 0 && (
          <div style={s.list}>
            {candidates.map((c) => (
              <ConventionCard
                key={c.id}
                candidate={c}
                repoFullName={activeRepo?.full_name}
                defaultBranch={activeRepo?.default_branch}
                onStatusChange={(status) => update.mutate({ id: c.id, patch: { status } })}
                onEdit={(patch) => update.mutate({ id: c.id, patch })}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
