import type { CSSProperties } from "react";
import { BODY_PREVIEW_MAX_HEIGHT } from "./constants";

/** Co-located styles for ImportSkillDrawer. */
export const s = {
  body: { padding: 24 } satisfies CSSProperties,
  footer: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies CSSProperties,
  chooseRow: { display: "flex", alignItems: "center", gap: 12 } satisfies CSSProperties,
  /** Visually hidden but still focusable/labelled — the Button drives it. */
  fileInput: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    opacity: 0,
    overflow: "hidden",
  } satisfies CSSProperties,
  filename: { fontSize: 13, color: "var(--text-muted)", minWidth: 0, wordBreak: "break-all" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)", marginTop: 4 } satisfies CSSProperties,
  callout: {
    display: "flex",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    border: "1px solid var(--warn, #f59e0b)",
    background: "var(--warn-bg, rgba(245,158,11,0.08))",
    marginBottom: 22,
  } satisfies CSSProperties,
  calloutIcon: { color: "var(--warn, #f59e0b)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  calloutTitle: { fontSize: 13, fontWeight: 700, marginBottom: 4 } satisfies CSSProperties,
  calloutBody: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 } satisfies CSSProperties,
  section: { marginBottom: 22 } satisfies CSSProperties,
  derivedRow: { display: "flex", gap: 12, alignItems: "baseline", marginBottom: 8 } satisfies CSSProperties,
  derivedTerm: { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", width: 92, flexShrink: 0 } satisfies CSSProperties,
  derivedValue: { fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, minWidth: 0 } satisfies CSSProperties,
  bodyPreview: {
    maxHeight: BODY_PREVIEW_MAX_HEIGHT,
    overflow: "auto",
    padding: 14,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 12.5,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 6, listStyle: "none" } satisfies CSSProperties,
  listItem: { fontSize: 12.5, color: "var(--text-secondary)" } satisfies CSSProperties,
  hint: { fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.45 } satisfies CSSProperties,
  unsaved: {
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--text-muted)",
    paddingTop: 14,
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
} as const;
