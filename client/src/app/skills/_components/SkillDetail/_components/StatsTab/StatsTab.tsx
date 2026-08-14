/* StatsTab — usage stats for a skill. Deliberately narrow: version count and
   linked agents are the only usage signal the schema actually tracks today.
   Pull frequency, accept rate and findings-by-category need a `skill_id` on
   findings plus usage-event tracking that doesn't exist yet — later lesson. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, MetricCard, SectionLabel, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillStats } from "@/lib/hooks/skills";
import { s } from "./styles";

export function StatsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { data, isLoading, isError, refetch } = useSkillStats(skill.id);

  if (isLoading) {
    return (
      <div style={s.skeletons}>
        <Skeleton height={90} />
        <Skeleton height={90} />
      </div>
    );
  }
  if (isError || !data) return <ErrorState body={t("stats.loadError")} onRetry={() => refetch()} />;

  return (
    <div style={s.wrap}>
      <div style={s.cards}>
        <MetricCard
          label={t("stats.usedBy")}
          value={data.agents_linked}
          suffix={` ${t("stats.agentsSuffix", { count: data.agents_linked })}`}
        />
        <MetricCard label={t("stats.versionsLabel")} value={data.versions} />
      </div>

      <SectionLabel icon="Users">{t("stats.agentsUsing")}</SectionLabel>
      {data.agents.length === 0 ? (
        <EmptyState icon="Users" title={t("stats.empty.title")} body={t("stats.empty.body")} />
      ) : (
        <div style={s.list}>
          {data.agents.map((agent) => (
            <div key={agent.id} style={s.row}>
              <span style={s.name}>{agent.name}</span>
              <Link href={`/agents/${agent.id}`} style={{ color: "var(--accent)", fontSize: 13 }}>
                {t("stats.open")}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
