/* AgentEditor — the agent's tabbed editor. Config (model + system prompt) and
   Skills (which skill blocks go into the prompt, and in what order) are built;
   Evals/Stats/CI arrive in later lessons. Tab state lives in ?tab= so a reload
   or a shared link lands on the same tab. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { SkillsTab } from "./_components/SkillsTab";
import { TABS } from "./constants";
import { s } from "./styles";

export function AgentEditor({ agent, tab, onTab }: { agent: Agent; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("agents");
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));
  return (
    <div style={s.wrap}>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      {/* Unknown/unbuilt tab keys fall back to Config — page.tsx already filters
          ?tab= against VALID_TABS, this is the second line of defence. */}
      <div style={s.body}>
        {tab === "skills" ? <SkillsTab agent={agent} /> : <ConfigTab agent={agent} />}
      </div>
    </div>
  );
}
