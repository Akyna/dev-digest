/* VersionsTab — immutable body snapshots, newest first. Restoring an old body
   is a normal edit: it appends a NEW version, it never rewrites history. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, ErrorState, SectionLabel, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { bodyHeadline, formatCreatedAt, newestFirst } from "./helpers";
import { s } from "./styles";

export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();

  if (isLoading) {
    return (
      <div style={s.skeletons}>
        <Skeleton height={64} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </div>
    );
  }
  if (isError) return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;

  const versions = newestFirst(data ?? []);
  if (versions.length === 0) {
    return <EmptyState icon="History" title={t("versions.empty.title")} body={t("versions.empty.body")} />;
  }

  const currentVersion = versions[0]?.version ?? skill.version;

  const onRestore = (version: number) =>
    restore.mutate(
      { id: skill.id, version },
      {
        onSuccess: (updated) =>
          toast.success(t("versions.restoredToast", { from: version, version: updated.version })),
      },
    );

  return (
    <div style={s.wrap}>
      <SectionLabel icon="History">{t("versions.title")}</SectionLabel>
      <p style={s.note}>{t("versions.note")}</p>
      <div style={s.list}>
        {versions.map((v) => {
          const isCurrent = v.version === currentVersion;
          return (
            <div key={v.version} style={s.row}>
              <div style={s.rowText}>
                <div style={s.topLine}>
                  <Badge mono color="var(--text-secondary)">
                    {t("versions.version", { version: v.version })}
                  </Badge>
                  {isCurrent && (
                    <Badge color="var(--ok)" icon="Check">
                      {t("versions.current")}
                    </Badge>
                  )}
                  <span style={s.when}>{formatCreatedAt(v.created_at)}</span>
                </div>
                <div style={s.headline}>{bodyHeadline(v.body)}</div>
              </div>
              {!isCurrent && (
                <Button
                  kind="secondary"
                  size="sm"
                  icon="History"
                  onClick={() => onRestore(v.version)}
                  disabled={restore.isPending}
                >
                  {restore.isPending ? t("versions.restoring") : t("versions.restore")}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
