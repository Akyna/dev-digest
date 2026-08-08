/* CreateSkillModal — author a skill from scratch.

   The description field carries a hint on purpose: the description is the
   skill's interface. It is what an agent reads when deciding whether to pull
   the skill into its prompt, so it has to be written directively ("Use when …")
   and the UI has to say so at the moment it is written. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal, SelectInput, Textarea, TextInput } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useCreateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { approxTokens } from "@/lib/tokens";
import { BODY_ROWS, DEFAULT_SKILL_TYPE, MODAL_WIDTH, SKILL_TYPE_VALUES } from "./constants";
import { buildCreateInput, canCreate } from "./helpers";
import { s } from "./styles";

export function CreateSkillModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (skill: Skill) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const create = useCreateSkill();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>(DEFAULT_SKILL_TYPE);
  const [body, setBody] = React.useState("");

  const fields = { name, description, type, body };
  const typeOptions = SKILL_TYPE_VALUES.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const submit = () =>
    create.mutate(buildCreateInput(fields), {
      // Failures surface through the global mutation error toast; only the
      // success path is confirmed (and selected) here.
      onSuccess: (skill) => {
        toast.success(t("create.createdToast", { name: skill.name }));
        onCreated?.(skill);
        onClose();
      },
    });

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button
            kind="primary"
            icon="Plus"
            onClick={submit}
            disabled={create.isPending || !canCreate(fields)}
          >
            {create.isPending ? t("create.creating") : t("create.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("create.fields.name")} required>
          <TextInput value={name} onChange={setName} placeholder={t("create.fields.namePlaceholder")} />
        </FormField>

        <FormField label={t("create.fields.description")} hint={t("create.fields.descriptionHint")}>
          <Textarea
            value={description}
            onChange={setDescription}
            placeholder={t("create.fields.descriptionPlaceholder")}
            rows={2}
          />
        </FormField>

        <FormField label={t("create.fields.type")}>
          <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
        </FormField>

        <FormField
          label={t("create.fields.body")}
          required
          right={<span style={s.tokens}>{t("config.tokens", { count: approxTokens(body) })}</span>}
        >
          <Textarea
            value={body}
            onChange={setBody}
            placeholder={t("create.fields.bodyPlaceholder")}
            rows={BODY_ROWS}
            mono
          />
        </FormField>
      </div>
    </Modal>
  );
}
