/* /skills — the Skills Lab. Two panes: the skill list on the left, the selected
   skill's editor on the right.

   Selection and tab live in the URL (`?skill=&tab=`) rather than in state, so a
   skill someone is reviewing can be linked to and survives a reload. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { SkillCard } from "../SkillCard";
import { SkillDetail } from "../SkillDetail";
import { DEFAULT_TAB } from "../../constants";
import { CreateSkillModal } from "./_components/CreateSkillModal";
import { ImportSkillDrawer } from "./_components/ImportSkillDrawer";
import { MENU_WIDTH, SKELETON_COUNT, SKELETON_HEIGHT } from "./constants";
import { filterSkills, findSelected, resolveTab } from "./helpers";
import { s } from "./styles";

export function SkillsListView() {
  const t = useTranslations("skills");
  const router = useRouter();
  const params = useSearchParams();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const all = skills ?? [];
  const list = filterSkills(all, query);
  const selected = findSelected(all, params.get("skill"));
  const tab = resolveTab(params.get("tab"));

  /** Writes selection/tab back to the URL — `replace` so paging through skills
      doesn't stack a history entry per click. */
  const setParams = (next: { skill?: string; tab?: string }) => {
    const sp = new URLSearchParams(params.toString());
    if (next.skill !== undefined) sp.set("skill", next.skill);
    if (next.tab !== undefined) sp.set("tab", next.tab);
    router.replace(`/skills?${sp.toString()}`);
  };

  const select = (skill: Skill) => setParams({ skill: skill.id, tab });
  const selectNew = (skill: Skill) => setParams({ skill: skill.id, tab: DEFAULT_TAB });

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {creating && <CreateSkillModal onClose={() => setCreating(false)} onCreated={selectNew} />}
      {importing && <ImportSkillDrawer onClose={() => setImporting(false)} onImported={selectNew} />}

      <div style={s.page}>
        <aside style={s.left}>
          <div style={s.leftHeader}>
            <div style={s.titleRow}>
              <h1 style={s.h1}>{t("page.heading")}</h1>
              <Dropdown
                width={MENU_WIDTH}
                align="right"
                trigger={
                  <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                    {t("page.addSkill")}
                  </Button>
                }
                items={[
                  {
                    label: t("page.menu.createFromScratch"),
                    icon: "Edit",
                    onClick: () => setCreating(true),
                  },
                  { divider: true },
                  { label: t("page.menu.fromFile"), icon: "Upload", onClick: () => setImporting(true) },
                ]}
              />
            </div>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
            <div style={s.search}>
              <Icon.Search size={13} style={s.searchIcon} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("page.searchPlaceholder")}
                style={s.searchInput}
              />
            </div>
          </div>

          <div style={s.list}>
            {isLoading && (
              <div style={s.skeletons}>
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <Skeleton key={i} height={SKELETON_HEIGHT} />
                ))}
              </div>
            )}
            {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
            {!isLoading && !isError && all.length === 0 && (
              <EmptyState
                icon="Sparkles"
                title={t("page.empty.title")}
                body={t("page.empty.body")}
                cta={t("page.empty.cta")}
                onCta={() => setImporting(true)}
              />
            )}
            {!isLoading && !isError && all.length > 0 && list.length === 0 && (
              <EmptyState icon="Search" title={t("page.noMatch.title")} body={t("page.noMatch.body")} />
            )}
            {list.length > 0 && (
              <div style={s.grid}>
                {list.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    active={skill.id === selected?.id}
                    onClick={() => select(skill)}
                    // The card toggle is the global kill switch: a disabled skill
                    // drops out of every agent's assembled prompt.
                    onToggle={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <section style={s.right}>
          {selected ? (
            <SkillDetail skill={selected} tab={tab} onTab={(next) => setParams({ tab: next })} />
          ) : (
            <EmptyState
              icon="Sparkles"
              title={t("page.selectPrompt.title")}
              body={t("page.selectPrompt.body")}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
