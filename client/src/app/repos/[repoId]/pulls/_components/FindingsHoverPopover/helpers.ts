import type { Finding, Severity } from "@devdigest/shared";

/** Render/sort order used everywhere findings are grouped by severity. */
export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const c: Record<Severity, number> = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) c[f.severity] += 1;
  return c;
}

/**
 * CRITICAL → WARNING → SUGGESTION, ties broken by confidence (desc). The
 * server already returns `top_findings` in this order; sorting again here is
 * a no-op for that caller but makes the Timeline (which has no server-side
 * sort — it groups the already-fetched `ReviewRecord.findings`) match too.
 */
export function sortFindings(findings: Finding[]): Finding[] {
  const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);
  return [...findings].sort((a, b) => rank(a.severity) - rank(b.severity) || b.confidence - a.confidence);
}

export function filterBySeverity(findings: Finding[], severity: Severity | null): Finding[] {
  return severity ? findings.filter((f) => f.severity === severity) : findings;
}
