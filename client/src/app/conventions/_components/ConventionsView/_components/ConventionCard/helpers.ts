import { githubBlobUrl } from "@/lib/github-urls";

/** `default_branch` doubles as the "sha" — `githubBlobUrl` just needs a valid
    git ref, and there is no PR head here (this is a repo-wide scan, not a
    review), so the clone's default branch is the closest stable anchor. */
export function conventionFileHref(
  repoFullName: string | null | undefined,
  defaultBranch: string | null | undefined,
  path: string,
  line: number | null,
): string | undefined {
  if (!repoFullName || !defaultBranch || !path) return undefined;
  return githubBlobUrl(repoFullName, defaultBranch, path, line ?? undefined);
}
