import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView. */
export const s = {
  page: { padding: "20px 24px", maxWidth: 960, margin: "0 auto" } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 6,
  } satisfies CSSProperties,
  h1: { fontSize: 20, fontWeight: 700 } satisfies CSSProperties,
  subtitle: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginTop: 6,
    lineHeight: 1.5,
    maxWidth: 620,
  } satisfies CSSProperties,
  headerActions: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 } satisfies CSSProperties,
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 12,
    color: "var(--text-muted)",
    margin: "10px 0 18px",
  } satisfies CSSProperties,
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  skeletons: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
} as const;
