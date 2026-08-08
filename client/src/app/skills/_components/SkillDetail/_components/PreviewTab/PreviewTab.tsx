/* PreviewTab — the saved body rendered as markdown, i.e. what the reviewing
   agent actually receives once this skill is spliced into the prompt. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState, Markdown, SectionLabel } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { s } from "./styles";

export function PreviewTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");

  if (!skill.body.trim()) {
    return <EmptyState icon="Eye" title={t("previewTab.empty.title")} body={t("previewTab.empty.body")} />;
  }

  return (
    <div style={s.wrap}>
      <SectionLabel icon="Eye">{t("previewTab.title")}</SectionLabel>
      <p style={s.note}>{t("previewTab.note")}</p>
      <div style={s.body}>
        <Markdown>{skill.body}</Markdown>
      </div>
    </div>
  );
}
