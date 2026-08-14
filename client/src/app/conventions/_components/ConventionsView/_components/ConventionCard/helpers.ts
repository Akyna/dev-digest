import { githubBlobUrl } from "@/lib/github-urls";

/** `default_branch` doubles as the "sha" — `githubBlobUrl` just needs a valid
    git ref, and there is no PR head here (this is a repo-wide scan, not a
    review), so the clone's default branch is the closest stable anchor. */
export function conventionFileHref(
  repoFullName: string | null | undefined,
  defaultBranch: string | null | undefined,
  path: string,
  line: number | null,
  endLine: number | null,
): string | undefined {
  if (!repoFullName || !defaultBranch || !path) return undefined;
  return githubBlobUrl(repoFullName, defaultBranch, path, line ?? undefined, endLine ?? undefined);
}

/** `path:line` or `path:line-endLine` — the label shown next to the evidence
    link, mirroring the "Detected in" range the server renders into the skill
    body when a grounded snippet spans more than one line. */
export function evidenceLabel(path: string, line: number | null, endLine: number | null): string {
  if (!line) return path;
  if (endLine && endLine > line) return `${path}:${line}-${endLine}`;
  return `${path}:${line}`;
}

/** Confidence meter color: <50% red, <80% orange, >=80% green. */
export function confidenceColor(pct: number): string {
  if (pct < 50) return "var(--crit)";
  if (pct < 80) return "var(--warn)";
  return "var(--ok)";
}
