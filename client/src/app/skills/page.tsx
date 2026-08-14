import React from "react";
import { SkillsListView } from "./_components/SkillsListView";

/* Route: /skills (Skills Lab). Thin route entry — the two-pane view, its create
   modal, import drawer, styles, constants, helpers and i18n are colocated under
   _components/SkillsListView.

   The view reads `?skill=` / `?tab=` via useSearchParams, which bails out of
   static prerendering unless it sits under a Suspense boundary. */
export default function SkillsPage() {
  return (
    <React.Suspense fallback={null}>
      <SkillsListView />
    </React.Suspense>
  );
}
