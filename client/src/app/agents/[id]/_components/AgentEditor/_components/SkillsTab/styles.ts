import type { CSSProperties } from "react";

/** Co-located styles for SkillsTab. */
export const s = {
  wrap: { maxWidth: 820, display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 12 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  count: { fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,

  /** The order hint is the whole mental model of this tab, so it gets a real
      callout rather than 11px grey text under the list. */
  hint: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 13,
    lineHeight: 1.5,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  hintIcon: { color: "var(--accent)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,

  warn: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    fontSize: 13,
    lineHeight: 1.5,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  warnIcon: { color: "var(--warn)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,

  filter: { position: "relative", display: "flex", alignItems: "center" } satisfies CSSProperties,
  filterIcon: {
    position: "absolute",
    left: 10,
    color: "var(--text-muted)",
    pointerEvents: "none",
  } satisfies CSSProperties,
  filterInput: {
    width: "100%",
    padding: "7px 10px 7px 30px",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
  } satisfies CSSProperties,

  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    marginTop: 4,
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,

  row: (attached: boolean, globallyOff: boolean, dragging = false): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${attached ? "var(--border-strong)" : "var(--border)"}`,
    background: attached ? "var(--bg-elevated)" : "transparent",
    // A globally disabled skill is dimmed even when attached: attaching it
    // changes nothing in the prompt until it is re-enabled.
    opacity: dragging ? 0.4 : globallyOff ? 0.62 : 1,
  }),
  dragHandle: {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    color: "var(--text-muted)",
    cursor: "grab",
  } satisfies CSSProperties,
  orderNum: {
    width: 20,
    textAlign: "right",
    fontSize: 12,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  } satisfies CSSProperties,
  rowMain: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  rowTop: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  name: { fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  description: {
    fontSize: 12.5,
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  source: { fontSize: 11, color: "var(--text-muted)" } satisfies CSSProperties,

  moveGroup: { display: "flex", gap: 2, flexShrink: 0 } satisfies CSSProperties,
  moveBtn: (enabled: boolean): CSSProperties => ({
    display: "inline-grid",
    placeItems: "center",
    width: 24,
    height: 24,
    borderRadius: 5,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    color: enabled ? "var(--text-secondary)" : "var(--text-muted)",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.4,
  }),

  actions: { display: "flex", alignItems: "center", gap: 10, marginTop: 4 } satisfies CSSProperties,
  dirtyNote: { fontSize: 13, color: "var(--warn)" } satisfies CSSProperties,
  savedNote: { fontSize: 13, color: "var(--ok)" } satisfies CSSProperties,
  noMatches: { fontSize: 13, color: "var(--text-muted)", padding: "8px 2px" } satisfies CSSProperties,
} as const;
