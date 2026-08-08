---
name: pr-self-review
description: Self-review all local changes against this repo's own skill catalog before a
  pull request is opened. Use before running git push on a feature branch, before gh pr
  create, when the user says "review my changes", "am I ready to open a PR", "check this
  before I push", or asks for a pre-PR / self review — even if the skill isn't named. Routes
  each changed path to the matching project skills (UI files to the react/next skills,
  server and reviewer-core files to onion-architecture, fastify, drizzle, postgres), runs
  the built-in code-review and security-review over the whole diff, and blocks the push on
  any unwaived CRITICAL finding. Does not apply fixes.
---

# PR Self Review

Catch problems in local changes before a pull request is even opened, by routing the diff to
the same skills that would review it in a real PR — plus a handful of deterministic,
repo-specific invariants no model needs to rediscover each time. This is an orchestrator, not
a review engine: it delegates diff parsing and finding structure to the built-in `code-review`
skill and normalizes everything into this repo's own `Finding` contract
(`server/src/vendor/shared/contracts/findings.ts`) and gate
(`reviewer-core/src/output/to-review.ts`, `gateTriggered(..., 'critical')`). Full rationale
and the decisions behind every choice below: `docs/pr-self-review-plan.md`.

Scope: the whole repo. Routing table: [routing.md](routing.md). Severity rules and the
CRITICAL rubric: [severity.md](severity.md). Deterministic checks: [invariants.md](invariants.md).
Finding/report/stamp shapes: [report-format.md](report-format.md).

## The six phases

**1. Acquire the diff.**

```sh
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)
git diff --name-status "$BASE"                      # committed-unpushed + staged + unstaged
git ls-files --others --exclude-standard              # untracked files
```
Handle: detached HEAD (compute `$BASE` against `main` directly); no upstream (same); `main`
itself checked out (warn, diff vs `origin/main@{u}`); empty diff (report clean, write no
stamp, stop); diff over ~2000 changed lines (review, but note per-lane truncation in the
report rather than silently dropping files).

**2. Run the invariants.** Every check in [invariants.md](invariants.md), against `$BASE` and
the full changed-file list (tracked + untracked). These never need a model and can produce
CRITICAL findings on their own — run them even if step 4 is skipped for any reason.

**3. Route.** Apply the [routing.md](routing.md) algorithm: match `CHANGED[]` against the
table to get one job per matched skill (max 6 rubric lanes), plus the two built-in lanes
(`code-review` on the whole diff at `medium` effort, `high` when the diff touches
`server/src/modules/**` or `reviewer-core/**`; `security-review` on the whole diff).

**4. Dispatch lanes in parallel.** Each rubric lane is a `Task` subagent given only that
skill's `SKILL.md` (+ `examples.md`/`references.md` if present) and only its file subset —
it reviews nothing outside that scope. Invoke `code-review` and `security-review` via the
Skill tool as-is; never pass `--fix` or `--comment` — this is a gate, it must not touch the
working tree or post anything.

**5. Normalize, dedupe, filter waivers.** Map every lane's output into the `Finding` shape
in [report-format.md](report-format.md), apply the severity rules in
[severity.md](severity.md) (confidence ≥ 0.8 required for CRITICAL; `code-review` PLAUSIBLE
caps at WARNING), dedupe overlapping findings, then drop anything matched by
`.pr-self-review-ignore.json` — waived findings move to the "Waived" section, they don't
disappear.

**6. Verdict, report, stamp.** Compute the verdict exactly like `gateTriggered`: any unwaived
CRITICAL → `REQUEST_CHANGES`; otherwise any finding → `COMMENT`; no findings → `APPROVE`.
Print the report ([report-format.md](report-format.md) template) and write
`.devdigest/pr-self-review.json`. **`files_hash` must be computed with this exact recipe —
byte-for-byte the same one `scripts/pr-self-review-gate.sh`'s `current_hash()` uses — or the
gate will never match it and every push blocks as "stale" regardless of the real verdict:**

```sh
{
  git diff "$BASE" --
  git ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do
    printf '%s\n' "$f"
    cat "$f"
  done
} | shasum -a 256 | awk '{print $1}'
```

This hashes full diff *content* for tracked changes plus full *content* of untracked files —
not just file names/status — so a stamp goes stale if an already-touched file is edited
further, even without the file set changing.

## Enforcement — what "blocked" means

- **This session:** on `REQUEST_CHANGES`, refuse to run `git push`, `gh pr create`, or any
  PR-opening command until either the CRITICAL findings are fixed and the skill re-run, or
  the user gives an explicit `override: <reason>` (record it in the stamp's `override` field).
- **Local, any session:** `scripts/pr-self-review-gate.sh` recomputes the stamp's
  `files_hash` and exits 1 with a reason if the stamp is missing, stale, or
  `REQUEST_CHANGES` with no override. It's wired into `.githooks/pre-push` (real `git push`)
  and, via `.claude/settings.json`'s `PreToolUse` hook, into any `git push`/`gh pr create`
  Claude itself attempts. `git push --no-verify` bypasses the git hook by design — this is a
  self-discipline tool, not a security control.
- **CI (observe-only for now):** `.github/workflows/pr-self-review-gate.yml` re-runs only the
  deterministic invariants on every PR and annotates unwaived CRITICALs. It does not yet
  block merge — promote it to a required branch-protection check once a trial period shows no
  false positives (see `docs/pr-self-review-plan.md` §8 #11, §6 Layer 2b).

## After the gate

Never auto-fix. If the user wants to act on WARNING/SUGGESTION findings, point them at the
`simplify` skill or `code-review --fix` — run explicitly, by them, afterward.

## Related skills

- [onion-architecture](../onion-architecture/SKILL.md), [react-architecture](../react-architecture/SKILL.md) —
  the two rubric skills whose "known violations" / escalation rules this skill must not
  re-report as new findings.
- [engineering-insights](../engineering-insights/SKILL.md) — run after the gate clears, not
  as part of it; captures anything genuinely learned this session.
- `code-review`, `security-review`, `simplify` — built-in skills this one delegates to or
  points at; see `docs/pr-self-review-plan.md` §2 for why each is reused rather than
  reimplemented.
