import type { CSSProperties } from "react";

/** Co-located styles for CreateSkillModal. */
export const s = {
  body: { padding: 24 } satisfies CSSProperties,
  footer: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies CSSProperties,
  tokens: { fontSize: 12, fontWeight: 600, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
