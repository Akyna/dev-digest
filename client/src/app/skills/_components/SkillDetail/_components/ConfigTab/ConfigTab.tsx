/* ConfigTab — the editable half of a skill: name, description (its interface),
   type and the markdown body. Saving a changed body mints a new version. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, TextInput, SelectInput, Textarea, Toggle, Button } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { approxTokens } from "@/lib/tokens";
import { BODY_ROWS, SKILL_TYPE_VALUES } from "./constants";
import { s } from "./styles";

export function ConfigTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();
  const [name, setName] = React.useState(skill.name);
  const [description, setDescription] = React.useState(skill.description);
  const [type, setType] = React.useState<SkillType>(skill.type);
  const [body, setBody] = React.useState(skill.body);

  // Reset the local form when switching skills in the left pane.
  React.useEffect(() => {
    setName(skill.name);
    setDescription(skill.description);
    setType(skill.type);
    setBody(skill.body);
  }, [skill.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeOptions = SKILL_TYPE_VALUES.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const save = () =>
    update.mutate(
      // `enabled` is deliberately NOT in this patch. The same flag is toggled
      // from SkillCard in the left pane, which is on screen at the same time;
      // mirroring it in local state meant a Save of an unrelated body edit
      // silently re-enabled a skill the user had just switched off — and this
      // flag drops the skill out of EVERY agent's prompt.
      { id: skill.id, patch: { name, description, type, body } },
      {
        // Failures surface through the global mutation error toast; confirm the
        // save (and the version it produced) here.
        onSuccess: (data) => toast.success(t("config.savedToast", { name: data.name, version: data.version })),
      },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        <label style={s.enabledLabel}>
          {t("config.enabled")}
          <Toggle
            on={skill.enabled}
            onChange={(next) => update.mutate({ id: skill.id, patch: { enabled: next } })}
            size={16}
          />
        </label>
      </div>

      <FormField label={t("config.name")} required>
        <TextInput value={name} onChange={setName} placeholder={t("config.namePlaceholder")} />
      </FormField>

      <FormField label={t("config.description")} hint={t("config.descriptionHint")}>
        <TextInput
          value={description}
          onChange={setDescription}
          placeholder={t("config.descriptionPlaceholder")}
        />
      </FormField>

      <FormField label={t("config.type")}>
        <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
      </FormField>

      <FormField
        label={t("config.body")}
        required
        hint={t("config.bodyHint")}
        right={<span style={s.tokens}>{t("config.tokens", { count: approxTokens(body) })}</span>}
      >
        <Textarea value={body} onChange={setBody} rows={BODY_ROWS} mono />
      </FormField>

      <div style={s.actions}>
        <Button
          kind="primary"
          icon="Check"
          onClick={save}
          disabled={update.isPending || !name.trim() || !body.trim()}
        >
          {update.isPending ? t("config.saving") : t("config.save")}
        </Button>
        {update.isSuccess && (
          <span style={s.savedNote}>{t("versions.version", { version: update.data?.version ?? 0 })}</span>
        )}
      </div>
    </div>
  );
}
