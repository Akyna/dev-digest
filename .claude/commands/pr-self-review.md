---
description: Run the pr-self-review protocol now — routes local changes to the matching skills and gates on any CRITICAL finding before you open a PR
---

Run the full **six-phase protocol** from the `pr-self-review` skill
(`.claude/skills/pr-self-review/SKILL.md`) right now, against the current local changes.

Flags, parsed from `$ARGUMENTS`:

- `--base <ref>` — diff against `<ref>` instead of the default merge-base with `main`.
- `--fast` — skip the rubric lanes (project skills); run only the invariants +
  `code-review`. Full multi-lane review is the default (no flag needed for it).
- `--tests` — also run `pnpm test` (not just `pnpm typecheck`) for each touched package.
  Server integration tests self-skip when Docker is unavailable.

Steps:

1. Acquire the diff (phase 1) using `--base` if given, else the skill's default.
2. Run the deterministic invariants (phase 2) from
   `.claude/skills/pr-self-review/invariants.md`.
3. Run `pnpm typecheck` for every touched package (client/server/reviewer-core, whichever
   have changed files); with `--tests`, also run each package's test command from
   `TESTING.md`.
4. Route the diff (phase 3) via `.claude/skills/pr-self-review/routing.md`. Skip the rubric
   lane dispatch if `--fast` was passed — invariants + `code-review` + `security-review`
   still run.
5. Dispatch lanes in parallel (phase 4).
6. Normalize, dedupe, apply waivers from `.pr-self-review-ignore.json` (phase 5).
7. Compute the verdict, print the report, write `.devdigest/pr-self-review.json` (phase 6).
8. If the verdict is `REQUEST_CHANGES`, say so plainly and do not proceed to `git push` or
   `gh pr create` in this session unless the user explicitly overrides.
