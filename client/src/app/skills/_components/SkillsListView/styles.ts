import type { CSSProperties } from "react";
import { CARD_GRID_COLS, LEFT_PANE_WIDTH, PANE_HEIGHT } from "./constants";

/** Co-located styles for SkillsListView. */
export const s = {
  page: { display: "flex", height: PANE_HEIGHT } satisfies CSSProperties,
  left: {
    width: LEFT_PANE_WIDTH,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  leftHeader: { padding: "16px 16px 12px" } satisfies CSSProperties,
  titleRow: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  subtitle: {
    fontSize: 12,
    color: "var(--text-secondary)",
    margin: "8px 0 12px",
    lineHeight: 1.45,
  } satisfies CSSProperties,
  search: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  searchIcon: { color: "var(--text-muted)", flexShrink: 0 } satisfies CSSProperties,
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  list: { flex: 1, minHeight: 0, overflow: "auto", padding: "0 12px 12px" } satisfies CSSProperties,
  grid: { display: "grid", gridTemplateColumns: CARD_GRID_COLS, gap: 0 } satisfies CSSProperties,
  skeletons: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  right: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,
} as const;
