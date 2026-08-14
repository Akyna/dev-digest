/* SkillsTab — attach workspace skills to this agent and order them.
   The order of the list IS the order of the skill blocks in the assembled
   review prompt, which is why reordering is a first-class control here and why
   the whole set is saved in one call (`POST /agents/:id/skills`). */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, ErrorState, Icon, Skeleton, Toggle } from "@devdigest/ui";
import type { Agent, Skill } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills, useSkills } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SKILLS_HREF, SKILL_TYPE_COLOR } from "./constants";
import { linkedSkillIds, matchesFilter, moveId, reorderIds, sameOrder, splitSkills } from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const toast = useToast();

  const { data: skills, isLoading: skillsLoading, isError, refetch } = useSkills();
  // `linksError` is load-bearing, not defensive noise: on a failed fetch React
  // Query settles with data === undefined and isLoading === false, so without
  // this the tab would render "0 of N enabled" and the next Save would POST an
  // empty/partial set — silently destroying the agent's real skill links.
  const {
    data: links,
    isLoading: linksLoading,
    isError: linksError,
    refetch: refetchLinks,
  } = useAgentSkills(agent.id);
  const setAgentSkills = useSetAgentSkills();

  /** What the server currently has, in prompt order. */
  const saved = React.useMemo(() => linkedSkillIds(links), [links]);

  // Draft = the edit in progress. Attaching and reordering are BOTH edits to
  // this one array, and both are committed by the single Save below; firing a
  // request per arrow press would persist half-finished orderings.
  const [draft, setDraft] = React.useState<string[]>(saved);
  const [filter, setFilter] = React.useState("");
  // Id of the row currently being dragged, or null. Reordering acts on the
  // real `draft` array (see `reorderIds`), so a drag lands correctly even
  // while `filter` is narrowing what rows are on screen.
  const [dragId, setDragId] = React.useState<string | null>(null);

  // Re-sync when the server set changes — a different agent, or our own save
  // landing. React Query's structural sharing keeps `links` stable otherwise,
  // so an unrelated refetch will not stomp an in-progress edit.
  React.useEffect(() => setDraft(saved), [saved]);

  const dirty = !sameOrder(draft, saved);
  const all = skills ?? [];
  const { attached, available } = splitSkills(all, draft);

  // Attaching a skill that is switched off workspace-wide is a no-op in the
  // prompt — the single sharpest trap on this screen, so it gets a banner.
  const disabledAttached = attached.filter((sk) => !sk.enabled);

  const shownAttached = attached.filter((sk) => matchesFilter(sk, filter));
  const shownAvailable = available.filter((sk) => matchesFilter(sk, filter));
  const nothingMatches = filter.trim() !== "" && shownAttached.length === 0 && shownAvailable.length === 0;

  const attach = (id: string) => setDraft((d) => (d.includes(id) ? d : [...d, id]));
  const detach = (id: string) => setDraft((d) => d.filter((x) => x !== id));
  const move = (index: number, delta: number) => setDraft((d) => moveId(d, index, delta));

  const save = () => {
    if (links === undefined) return; // cannot diff against an unknown set
    setAgentSkills.mutate(
      { agentId: agent.id, skillIds: draft },
      { onSuccess: () => toast.success(t("skills.savedToast", { count: draft.length })) },
    );
  };

  if (isError || linksError) {
    return (
      <ErrorState
        body={t("skills.loadError")}
        onRetry={() => {
          void refetch();
          void refetchLinks();
        }}
      />
    );
  }

  if (skillsLoading || linksLoading) {
    return (
      <div style={s.wrap}>
        <Skeleton height={22} width={220} />
        <Skeleton height={64} />
        <Skeleton height={140} />
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <EmptyState
        icon="Sparkles"
        title={t("skills.emptyTitle")}
        body={
          <>
            {t("skills.emptyBody")}{" "}
            <Link href={SKILLS_HREF} style={{ color: "var(--accent)" }}>
              {t("skills.emptyCta")}
            </Link>
          </>
        }
      />
    );
  }

  /** One row. `index` is the 0-based prompt position, or null when detached. */
  const row = (skill: Skill, index: number | null) => {
    const isAttached = index !== null;
    const type = SKILL_TYPE_COLOR[skill.type];
    return (
      <div
        key={skill.id}
        data-testid={`skill-row-${skill.id}`}
        style={s.row(isAttached, !skill.enabled, dragId === skill.id)}
        draggable={isAttached}
        onDragStart={(e) => {
          setDragId(skill.id);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (isAttached && dragId) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId) setDraft((d) => reorderIds(d, dragId, skill.id));
          setDragId(null);
        }}
        onDragEnd={() => setDragId(null)}
      >
        {isAttached && (
          <span
            style={s.dragHandle}
            title={t("skills.dragHandle")}
            aria-label={t("skills.dragHandle")}
          >
            <Icon.ChevronsUpDown size={13} />
          </span>
        )}
        {isAttached && <span style={s.orderNum}>{index + 1}</span>}
        <Toggle
          on={isAttached}
          size={14}
          onChange={(on) => (on ? attach(skill.id) : detach(skill.id))}
        />
        <div style={s.rowMain}>
          <div style={s.rowTop}>
            <span style={s.name}>{skill.name}</span>
            <Badge color={type.color} bg={type.bg}>
              {skill.type}
            </Badge>
            <span style={s.source}>{t("skills.source", { source: skill.source })}</span>
            {!skill.enabled && (
              <span title={t("skills.globallyDisabledHint")}>
                <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle">
                  {t("skills.globallyDisabled")}
                </Badge>
              </span>
            )}
          </div>
          {skill.description && <div style={s.description}>{skill.description}</div>}
        </div>
        {isAttached && (
          <div style={s.moveGroup}>
            <button
              type="button"
              title={t("skills.moveUp")}
              aria-label={t("skills.moveUp")}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              style={s.moveBtn(index > 0)}
            >
              <Icon.ArrowUp size={13} />
            </button>
            <button
              type="button"
              title={t("skills.moveDown")}
              aria-label={t("skills.moveDown")}
              disabled={index === draft.length - 1}
              onClick={() => move(index, 1)}
              style={s.moveBtn(index < draft.length - 1)}
            >
              <Icon.ArrowDown size={13} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <span style={s.count}>{t("skills.enabledCount", { linked: attached.length, total: all.length })}</span>
      </div>

      <div style={s.hint}>
        <Icon.Info size={14} style={s.hintIcon} />
        <span>{t("skills.orderHint")}</span>
      </div>

      {disabledAttached.length > 0 && (
        <div style={s.warn}>
          <Icon.AlertTriangle size={14} style={s.warnIcon} />
          <span>
            {t("skills.disabledAttachedWarning", { count: disabledAttached.length })}{" "}
            <Link href={SKILLS_HREF} style={{ color: "var(--accent)" }}>
              {t("skills.manageSkills")}
            </Link>
          </span>
        </div>
      )}

      <div style={s.filter}>
        <Icon.Search size={13} style={s.filterIcon} />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("skills.filterPlaceholder")}
          aria-label={t("skills.filterPlaceholder")}
          style={s.filterInput}
        />
      </div>

      {nothingMatches && <div style={s.noMatches}>{t("skills.noMatches", { q: filter })}</div>}

      {shownAttached.length > 0 && (
        <>
          <div style={s.sectionLabel}>{t("skills.attached")}</div>
          <div style={s.list}>
            {/* Index comes from `attached`, not the filtered view: the arrows
                must move a skill within the real prompt order, not within a
                temporary search result. */}
            {shownAttached.map((sk) => row(sk, attached.indexOf(sk)))}
          </div>
        </>
      )}

      {shownAvailable.length > 0 && (
        <>
          <div style={s.sectionLabel}>{t("skills.available")}</div>
          <div style={s.list}>{shownAvailable.map((sk) => row(sk, null))}</div>
        </>
      )}

      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} loading={setAgentSkills.isPending} disabled={!dirty}>
          {setAgentSkills.isPending ? t("skills.saving") : t("skills.save")}
        </Button>
        {dirty && (
          <Button kind="tertiary" onClick={() => setDraft(saved)}>
            {t("skills.revert")}
          </Button>
        )}
        {dirty ? (
          <span style={s.dirtyNote}>{t("skills.unsaved")}</span>
        ) : (
          setAgentSkills.isSuccess && <span style={s.savedNote}>{t("skills.saved")}</span>
        )}
      </div>
    </div>
  );
}
