/**
 * USD run cost, rendered at ~2 significant digits so a $0.0013 run and a $1.25
 * run are both legible in the same column.
 *
 * A missing price is NOT zero: unknown-model runs, failed runs and runs from
 * before the cost column existed have no price at all, and reading them as
 * "$0.00" would claim they were free. Those render as an em-dash.
 *
 * (`model-label.ts` formats CATALOG prices per 1M tokens — a different thing.)
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return "—";
  if (usd === 0) return "$0"; // genuinely free model, e.g. glm-4.7-flash
  if (usd < 0.0001) return "<$0.0001";
  const fixed = usd.toFixed(usd >= 0.01 ? 3 : 4);
  // Trim trailing zeros, but keep at least 2 decimals: 0.060 → $0.06, 1.250 → $1.25.
  return `$${fixed.replace(/(\.\d\d)0+$/, "$1")}`;
}
