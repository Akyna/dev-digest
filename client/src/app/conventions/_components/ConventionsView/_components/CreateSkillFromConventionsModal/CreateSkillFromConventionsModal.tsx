/* CreateSkillFromConventionsModal — preview → edit → save flow, mirrored on
   ImportSkillDrawer: the server renders a draft body from the accepted
   conventions, the user can rename/rewrite it, then this POSTs the skill
   (source: 'extracted') and optionally links it to agents. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Button,
  Checkbox,
  FormField,
  Icon,
  Modal,
  SelectInput,
  Skeleton,
  Textarea,
  Toggle,
  TextInput,
} from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { useAgents } from "@/lib/hooks/agents";
import { useCreateSkillFromConventions, useSkillDraft } from "@/lib/hooks/conventions";
import { useToast } from "@/lib/toast";
import { approxTokens } from "@/lib/tokens";
import { canSubmit, defaultAgentIds } from "./helpers";
import { BODY_ROWS, DEFAULT_SKILL_TYPE, MODAL_WIDTH, SKILL_TYPE_VALUES } from "./constants";
import { s } from "./styles";

export function CreateSkillFromConventionsModal({
  repoId,
  repoName,
  conventionIds,
  onClose,
}: {
  repoId: string;
  repoName: string;
  conventionIds: string[];
  onClose: () => void;
}) {
  const t = useTranslations("conventions");
  const toast = useToast();
  const draft = useSkillDraft(repoId);
  const createSkill = useCreateSkillFromConventions(repoId);
  const { data: agents } = useAgents();

  const [subtitle, setSubtitle] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>(DEFAULT_SKILL_TYPE);
  const [body, setBody] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [agentIds, setAgentIds] = React.useState<string[]>([]);
  const [seededAgents, setSeededAgents] = React.useState(false);

  React.useEffect(() => {
    draft.mutate(conventionIds, {
      onSuccess: (d) => {
        // The generated name doubles as the subtitle — a fixed, repo-derived
        // label distinct from the (editable) name field below, so renaming the
        // skill doesn't also rewrite the subtitle out from under the user.
        setSubtitle(d.name);
        setName(d.name);
        setDescription(d.description);
        setBody(d.body);
      },
      onError: () => toast.error(t("modal.draftError")),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!seededAgents && agents && agents.length > 0) {
      setAgentIds(defaultAgentIds(agents));
      setSeededAgents(true);
    }
  }, [agents, seededAgents]);

  const toggleAgent = (id: string) =>
    setAgentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const typeOptions = SKILL_TYPE_VALUES.map((v) => ({ value: v, label: v }));

  const submit = () =>
    createSkill.mutate(
      {
        convention_ids: conventionIds,
        name,
        description,
        type,
        enabled,
        body,
        agent_ids: agentIds,
      },
      {
        onSuccess: (skill) => {
          toast.success(t("modal.createdToast", { name: skill.name }));
          onClose();
        },
      },
    );

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("modal.title")}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button
            kind="primary"
            icon="Sparkles"
            onClick={submit}
            disabled={draft.isPending || createSkill.isPending || !canSubmit(name, body)}
          >
            {createSkill.isPending ? t("modal.creating") : t("modal.create")}
          </Button>
        </div>
      }
    >
      {draft.isPending ? (
        <div style={s.body}>
          <Skeleton height={22} width={220} />
          <Skeleton height={220} />
        </div>
      ) : (
        <div style={s.body}>
          <div style={s.banner}>
            <Icon.Link size={15} style={s.bannerIcon} />
            <span>
              {t("modal.banner.mergedFrom", { count: conventionIds.length })}{" "}
              <Link href={`/repos/${repoId}/pulls`} style={s.bannerLink}>
                {repoName}
              </Link>
              . {t("modal.banner.editable")}
            </span>
          </div>

          <FormField label={t("modal.fields.name")} required>
            <TextInput value={name} onChange={setName} placeholder={t("modal.fields.namePlaceholder")} />
          </FormField>

          <FormField label={t("modal.fields.description")}>
            <Textarea value={description} onChange={setDescription} rows={2} />
          </FormField>

          <div style={s.row}>
            <div style={s.rowField}>
              <FormField label={t("modal.fields.type")}>
                <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
              </FormField>
            </div>
            <div style={s.rowField}>
              <FormField label={t("modal.fields.enabled")} hint={t("modal.fields.enabledHint")}>
                <Toggle on={enabled} onChange={setEnabled} />
              </FormField>
            </div>
          </div>

          <FormField
            label={t("modal.fields.body")}
            required
            right={<span style={s.tokens}>{t("modal.fields.tokens", { count: approxTokens(body) })}</span>}
          >
            <Textarea value={body} onChange={setBody} rows={BODY_ROWS} mono />
          </FormField>

          <FormField label={t("modal.fields.agents")} hint={t("modal.fields.agentsHint")}>
            <div style={s.agentList}>
              {(agents ?? []).length === 0 && <span style={s.agentEmpty}>{t("modal.fields.noAgents")}</span>}
              {(agents ?? []).map((a) => (
                <Checkbox
                  key={a.id}
                  checked={agentIds.includes(a.id)}
                  onChange={() => toggleAgent(a.id)}
                  label={a.name}
                />
              ))}
            </div>
          </FormField>
        </div>
      )}
    </Modal>
  );
}
