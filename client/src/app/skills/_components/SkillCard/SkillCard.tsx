/* SkillCard — one row in the left pane of /skills: name, type badge, source
   label, description, enabled toggle and an inline delete. Mirrors AgentCard. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill } from "@/lib/hooks/skills";
import { isUntrusted, typeColor } from "./helpers";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const del = useDeleteSkill();
  const color = typeColor(skill.type);
  const untrusted = isUntrusted(skill.source);

  const remove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t("listItem.deleteConfirm", { name: skill.name }))) del.mutate(skill.id);
  };

  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Sparkles size={15} />
        </div>
        <span style={s.name}>{skill.name}</span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
        <button
          onClick={remove}
          disabled={del.isPending}
          title={t("listItem.deleteTitle")}
          aria-label={t("listItem.deleteTitle")}
          style={s.deleteBtn(del.isPending)}
        >
          <Icon.Trash size={14} style={del.isPending ? s.spin : undefined} />
        </button>
      </div>
      <div style={s.description}>{skill.description || t("listItem.noDescription")}</div>
      <div style={s.metaRow}>
        <Badge color={color} bg={color + "1a"}>
          {t(`listItem.type.${skill.type}`)}
        </Badge>
        <span style={s.source}>{t(`listItem.source.${skill.source}`)}</span>
        {untrusted && (
          <Badge color="var(--warn, #f59e0b)" icon="AlertTriangle" style={{ marginLeft: "auto" }}>
            {t("listItem.needsVetting")}
          </Badge>
        )}
      </div>
    </div>
  );
}
