import type { CSSProperties } from "react";

/** Max popover list height ≈ 4 items before it scrolls (per spec). */
const VISIBLE_ITEMS = 4;
const ITEM_HEIGHT = 92;

export const s = {
  wrapper: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,
  chip: (color: string, active: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "2px 5px",
    borderRadius: 5,
    // Longhand only — mixing the `border` shorthand with `borderColor` here
    // triggers the same React "conflicting property" warning as FindingCard's
    // border (see its styles.ts for the full explanation).
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: active ? color : "transparent",
    background: active ? "var(--bg-hover)" : "transparent",
    color,
    font: "inherit",
    fontSize: 12.5,
    cursor: "pointer",
  }),
  popover: (rect: { top: number; left: number; width: number }): CSSProperties => ({
    position: "fixed",
    top: rect.top,
    left: rect.left,
    width: Math.min(rect.width, typeof window === "undefined" ? rect.width : window.innerWidth - 32),
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    boxShadow: "var(--shadow-modal)",
    zIndex: 60,
    overflow: "hidden",
  }),
  header: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  list: {
    maxHeight: VISIBLE_ITEMS * ITEM_HEIGHT,
    overflowY: "auto",
  } satisfies CSSProperties,
  item: (sevColor: string): CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    gap: 5,
    width: "100%",
    padding: "10px 14px",
    borderLeft: `2px solid ${sevColor}`,
    borderBottom: "1px solid var(--border)",
    background: "none",
    textAlign: "left",
    cursor: "pointer",
  }),
  itemHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,
  itemTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  itemMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,
  itemFile: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  itemRationale: {
    fontSize: 12,
    lineHeight: 1.4,
    color: "var(--text-secondary)",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } satisfies CSSProperties,
  muted: { color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
