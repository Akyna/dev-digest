import React from "react";
import { ConventionsView } from "./_components/ConventionsView";

/* Route: /conventions — scan the active repo's clone for de-facto coding
   conventions, review each candidate (accept/reject/edit), then turn the
   accepted set into a Skill. Thin route entry — the view, its modal, styles,
   constants, helpers and i18n are colocated under _components/ConventionsView. */
export default function ConventionsPage() {
  return (
    <React.Suspense fallback={null}>
      <ConventionsView />
    </React.Suspense>
  );
}
