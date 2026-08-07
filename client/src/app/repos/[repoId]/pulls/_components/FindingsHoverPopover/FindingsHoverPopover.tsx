/* FindingsHoverPopover — shared severity-chips trigger + hover popover for a
   review's findings. Used on the Pull Requests list (FINDINGS column) and on
   the PR detail page's Timeline (per-run findings). Hovering the chips opens
   a popover listing every finding (max ~4 visible, rest scrolls); clicking a
   severity chip filters the popover's own list; clicking a finding calls
   `onFindingClick` (list page navigates to the PR detail + Review Runs,
   Timeline scrolls to it in place — the caller decides). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV, CategoryTag, ConfidenceNum } from "@devdigest/ui";
import type { Finding, Severity } from "@devdigest/shared";
import { SEVERITY_ORDER, countBySeverity, sortFindings, filterBySeverity } from "./helpers";
import { s } from "./styles";

export function FindingsHoverPopover({
  findings,
  onFindingClick,
}: {
  findings: Finding[];
  onFindingClick: (findingId: string) => void;
}) {
  const t = useTranslations("prReview");
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const [activeSeverity, setActiveSeverity] = React.useState<Severity | null>(null);

  const sorted = React.useMemo(() => sortFindings(findings), [findings]);
  const counts = React.useMemo(() => countBySeverity(findings), [findings]);
  const visible = React.useMemo(() => filterBySeverity(sorted, activeSeverity), [sorted, activeSeverity]);

  React.useEffect(() => {
    if (!open) return;
    // Close on the PAGE scrolling (the popover's fixed position would go
    // stale) — but not when the scroll is the popover's own findings list
    // being scrolled: `scroll` doesn't bubble, so it's only observable here
    // via a capture-phase window listener, which also sees that internal
    // scroll and must not treat it as "the page moved".
    const close = (e: Event) => {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  if (findings.length === 0) return <span style={s.muted}>—</span>;

  const handleEnter = () => {
    const box = wrapperRef.current?.getBoundingClientRect();
    if (box) {
      const width = 380;
      const left = Math.min(box.left, window.innerWidth - width - 16);
      // Flush against the trigger (no gap): a gap is a dead zone the pointer
      // has to cross to reach the popover — since it isn't painted by any
      // descendant of the wrapper, crossing it fires mouseleave and the
      // popover closes before the cursor ever reaches the scrollable list.
      setRect({ top: box.bottom, left, width });
    }
    setOpen(true);
  };
  const handleLeave = () => {
    setOpen(false);
    setActiveSeverity(null);
  };

  return (
    <div
      ref={wrapperRef}
      style={s.wrapper}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={(e) => e.stopPropagation()}
    >
      {SEVERITY_ORDER.filter((sev) => counts[sev] > 0).map((sev) => {
        const meta = SEV[sev];
        const SevIcon = Icon[meta.icon];
        return (
          <button
            key={sev}
            type="button"
            className="tnum"
            style={s.chip(meta.c, activeSeverity === sev)}
            onClick={() => setActiveSeverity((cur) => (cur === sev ? null : sev))}
          >
            <SevIcon size={13} />
            {counts[sev]}
          </button>
        );
      })}

      {open && rect && (
        <div style={s.popover(rect)}>
          <div style={s.header}>
            <Icon.Info size={13} />
            {t("findingsPopover.count", { count: visible.length })}
          </div>
          <div style={s.list}>
            {visible.map((f) => {
              const meta = SEV[f.severity];
              const FindIcon = Icon[meta.icon];
              // A `<div role="button">`, not a real <button> — it contains
              // MonoLink, which is itself a button, and nested buttons are
              // invalid HTML (and break hydration).
              return (
                <div
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  style={s.item(meta.c)}
                  onClick={() => onFindingClick(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onFindingClick(f.id);
                  }}
                >
                  <div style={s.itemHeader}>
                    <FindIcon size={13} style={{ color: meta.c, flexShrink: 0 }} />
                    <span style={s.itemTitle}>{f.title}</span>
                    <CategoryTag category={f.category} />
                  </div>
                  <div style={s.itemMeta}>
                    <span className="mono" style={s.itemFile}>
                      {f.file}:{f.start_line}
                    </span>
                    <ConfidenceNum value={f.confidence} />
                  </div>
                  <div style={s.itemRationale}>{f.rationale}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default FindingsHoverPopover;
