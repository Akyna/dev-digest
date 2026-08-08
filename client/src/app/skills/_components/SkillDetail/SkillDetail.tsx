/* SkillDetail — right pane of /skills. Tab shell over the skill's config,
   rendered preview and version history. Tab state lives in ?tab=. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, EmptyState, Icon, Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { VersionsTab } from "./_components/VersionsTab";
import { DEFAULT_TAB, TABS } from "./constants";
import { s } from "./styles";

export function SkillDetail({
  skill,
  tab,
  onTab,
}: {
  skill: Skill;
  tab: string;
  onTab: (t: string) => void;
}) {
  const t = useTranslations("skills");
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));
  const active = TABS.find((tb) => tb.key === tab) ?? TABS.find((tb) => tb.key === DEFAULT_TAB)!;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <Icon.Sparkles size={18} style={{ color: "var(--accent)" }} />
        <h1 style={s.h1}>{skill.name}</h1>
        <Badge mono color="var(--text-secondary)">
          {t("versions.version", { version: skill.version })}
        </Badge>
        {!skill.enabled && <Badge color="var(--text-muted)">{t("preview.disabled")}</Badge>}
      </div>

      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={active.key} onChange={onTab} pad="0 28px" />
      </div>

      <div style={s.body}>
        {active.key === "config" && <ConfigTab skill={skill} />}
        {active.key === "preview" && <PreviewTab skill={skill} />}
        {active.key === "versions" && <VersionsTab skill={skill} />}
        {active.placeholder && (
          <EmptyState
            icon={active.icon}
            title={t(`detail.placeholder.${active.key}.title`)}
            body={t(`detail.placeholder.${active.key}.body`)}
          />
        )}
      </div>
    </div>
  );
}
