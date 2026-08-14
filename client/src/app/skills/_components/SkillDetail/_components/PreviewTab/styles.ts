import type { CSSProperties } from "react";

/** Co-located styles for PreviewTab. */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  note: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginBottom: 14,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  body: {
    padding: 20,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 14,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
} as const;
