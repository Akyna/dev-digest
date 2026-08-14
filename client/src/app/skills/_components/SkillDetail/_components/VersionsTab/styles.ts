import type { CSSProperties } from "react";

/** Co-located styles for VersionsTab. */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  note: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginBottom: 16,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  rowText: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  headline: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginTop: 4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  topLine: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  when: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  skeletons: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
} as const;
