import type { CSSProperties } from "react";

/** Co-located styles for PromptBlock. */
export const s = {
  miniBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderRadius: 5,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    color: "var(--text-muted)",
    cursor: "pointer",
  } satisfies CSSProperties,
  /** Deliberately subdued: the estimate is metadata about the block, never
      competing with the block's label or its content. */
  tokens: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  actions: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
} as const;
