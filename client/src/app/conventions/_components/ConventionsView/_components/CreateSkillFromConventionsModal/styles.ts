import type { CSSProperties } from "react";

export const s = {
  body: { padding: 24 } satisfies CSSProperties,
  footer: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies CSSProperties,
  tokens: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  agentList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 160,
    overflow: "auto",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 10,
  } satisfies CSSProperties,
  agentEmpty: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
