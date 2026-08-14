# Implementation plan — `pr-self-review` meta-skill

Status: **plan only, not implemented**. Written for a Sonnet-model implementer to follow
step by step. Produced via Opus-model research/planning against the state of the repo on
2026-08-07, then extended with two follow-up decisions (waiver mechanism, CI parity check).

## 0. Goal

A new meta-skill, `pr-self-review`, that runs before a PR is opened (or manually) and:

1. Reads all open/local changes — uncommitted + committed-but-unpushed vs. the base branch.
2. Routes each changed file to whichever of our existing project skills actually applies to
   it (UI skills → `client/**`, backend/architecture skills → `server/`, `reviewer-core/`),
   instead of running every skill against everything.
3. Blocks the user from merging if at least one **CRITICAL** finding turns up.

It is an orchestrator that reuses the repo's own finding/severity contract and the built-in
`code-review` / `security-review` skills — it does not reimplement diff parsing or review
logic itself.

## 1. Research findings that shape this plan

| Question | Answer |
|---|---|
| Git hook infra | **None.** `.git/hooks/` has only `*.sample`; no husky/lint-staged/simple-git-hooks. `core.hooksPath` unset. Must be introduced from scratch. |
| `.claude/settings.json` | **Does not exist.** `.claude/` currently has only `commands/` and `skills/`. |
| `gh` CLI | **Not installed.** A `gh pr create` wrapper can't be the primary trigger today; PRs are likely opened via the GitHub web UI, which the pre-push hook still covers. |
| CI | 5 path-filtered workflows in `.github/workflows/` (`client`, `server-unit`, `server-integration`, `reviewer-core`, `e2e-web`), each running `pnpm typecheck` + `pnpm test` per package. |
| `scripts/` | `dev.sh`, `e2e.sh` only. No PR wrapper. |
| `ReportFindings` tool | **Not reachable from a project skill** — it's internal to the built-in `code-review` skill's own subagent harness. |
| Repo's own finding contract | `server/src/vendor/shared/contracts/findings.ts` — `Severity = CRITICAL|WARNING|SUGGESTION`, `FindingCategory = bug|security|perf|style|test`, full `Finding`/`Review` shape. |
| Repo's own gate | `reviewer-core/src/output/to-review.ts` — `SEV_RANK`, `FAIL_ON_MIN_RANK`, `gateTriggered(findings, failOn)`, `countBlockers()`, default `failOn: 'critical'`. `CiFailOn = never|critical|warning|any` in `contracts/knowledge.ts`. |
| Severity vocab already in project skills | `react-best-practices` tags CRITICAL/HIGH/MEDIUM; `security` uses HIGH/MEDIUM/LOW confidence with "LOW → do not report". |

**Consequence:** this repo already owns a severity taxonomy, a `Finding` schema, and a
deterministic gate function. `pr-self-review` dogfoods those rather than inventing a new
shape or reaching for `ReportFindings` (unavailable, severity-less).

## 2. Architecture

```
/pr-self-review
      │
      ├─ [1] DIFF ACQUISITION ......... deterministic bash, no model
      │
      ├─ [2] INVARIANT CHECKS ......... deterministic grep/git, always CRITICAL-capable
      │
      ├─ [3] ROUTING .................. path-globs (routing.md) → (skill × file-subset) jobs
      │
      ├─ [4] EXECUTION (parallel, max 6 rubric lanes)
      │      ├─ rubric lanes ......... one Task subagent per matched project skill,
      │      │                          given that skill's SKILL.md + only its file subset
      │      ├─ correctness lane ..... delegate to built-in `code-review` (its own
      │      │                          diff engine + ReportFindings, untouched)
      │      └─ security lane ........ delegate to built-in `security-review`
      │
      ├─ [5] NORMALIZE + WAIVER FILTER  every lane's output → repo's `Finding` shape,
      │                                 drop anything matched by .pr-self-review-ignore.json
      │
      └─ [6] GATE + STAMP ............. gateTriggered(findings,'critical') semantics
                                        → .devdigest/pr-self-review.json
```

### Relationship to built-in skills

| Built-in | Reused how | Why not reimplement |
|---|---|---|
| `code-review` | Invoked once on the whole diff, fixed effort level (default `medium`, `high` for `server/src/modules/**` / `reviewer-core/**`). Its findings are the correctness lane. Never pass `--fix`/`--comment` from inside `pr-self-review`. | Already does diff parsing, hunk anchoring, confidence triage, multi-agent breadth. |
| `security-review` | Invoked once on the whole branch diff → feeds the `security` category. | Complements (doesn't replace) the project `security` rubric skill. |
| `simplify` | **Not invoked** by the gate itself — a review gate must never mutate the working tree. Offered as the recommended follow-up command after findings are accepted (§6 addition, auto-remediate step). | — |

### `ReportFindings` decision

Do not call `ReportFindings` from `pr-self-review` and do not propose adding severity to it —
it isn't reachable. Normalize everything into the repo's own `Finding` contract instead.
`code-review`'s verdict maps to *confidence*, not severity: `CONFIRMED → 0.9`,
`PLAUSIBLE → 0.5`. **Hard rule: only confidence ≥ 0.8 findings may be CRITICAL** — a
`PLAUSIBLE` finding caps at `WARNING` and can never block the gate.

## 3. Diff acquisition (exact commands)

```sh
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)
git diff --name-status "$BASE"                    # committed-unpushed + staged + unstaged
git ls-files --others --exclude-standard           # untracked files (not covered above)
git diff "$BASE" -- <paths...>                      # per-subset unified diff fed to a lane
git diff --no-index /dev/null <untracked-file>       # untracked shown as pure additions
```

Edge cases to handle explicitly: detached HEAD, branch with no upstream, `main` itself
checked out (warn, diff vs `origin/main@{u}`), empty diff (exit clean, no stamp), diff
> ~2000 changed lines (per-lane truncation, reported, not silently dropped).

## 4. Skill-matching logic

**Mechanism: a maintained routing table (`routing.md`), not runtime inference from skill
descriptions.** Descriptions are written for prose trigger-matching, not path prediction,
and some skills are vendored with hashes pinned in `skills-lock.json` — their descriptions
can change under us on the next sync. A committed table is diffable and testable; the
maintenance cost is enforced by invariant INV-9 (routing.md must be updated when a skill is
added).

| Skill | Lane | Path globs (match ⇒ run) | Gates? |
|---|---|---|---|
| `react-architecture` | UI | `client/**`, only when the subset has added/renamed/deleted files (it judges placement, not content) | yes |
| `react-best-practices` | UI | `client/**/*.tsx`, `client/src/lib/hooks/**`, `client/src/lib/*.tsx` | yes |
| `next-best-practices` | UI | `client/src/app/**`, diff adds `'use client'`/`'use server'`, `client/next.config.*`, `client/src/middleware.*` | yes |
| `react-testing-library` | UI | `client/**/*.test.tsx`, `client/**/*.test.ts`, `client/src/test/**` | warn-only |
| `onion-architecture` | BE | `server/src/modules/**`, `server/src/adapters/**`, `server/src/platform/**`, `reviewer-core/src/**` | yes |
| `fastify-best-practices` | BE | `server/src/**/routes.ts`, `server/src/app.ts`, `server/src/server.ts`, `server/src/platform/{errors,sse,resilience,jobs}.ts` | yes |
| `drizzle-orm-patterns` | BE | `server/src/db/**`, `server/src/**/repository.ts` | yes |
| `postgresql-table-design` | BE | `server/src/db/schema/**`, `server/src/db/migrations/**` | yes |
| `security` | cross-cutting, always | any `**/*.{ts,tsx,js,mjs,sql,yml,sh}` change | yes |
| `typescript-expert` | cross-cutting, content-triggered | `**/*.d.ts`, `**/tsconfig*.json`, or diff adds `: any` / `as unknown as` / `@ts-ignore` / non-null `!.` | warn-only |
| `zod` | cross-cutting, content-triggered | file imports `zod`, or `server/src/vendor/shared/contracts/**` | yes |
| `mermaid-diagram` | excluded | authoring aid, no reviewable invariant | never |
| `engineering-insights` | excluded from review, runs after the gate as session wrap-up | never |

Uncovered surface: `e2e/**` has no project skill → routed to the correctness lane + INV-6.
`.github/workflows/**` → INV-8 only.

**Algorithm:** build `CHANGED[]` (path + A/M/D/R status) → drop `node_modules/`, `dist/`,
`.next/`, `test-results/`, `server/clones/**`, lockfiles → for each routing.md row compute
`SUBSET = CHANGED ∩ globs` (+ content-trigger regex where applicable) → emit a job per
non-empty subset, cap at 6 rubric lanes (largest subsets kept, drop noted in report) →
always also emit `code-review` and `security-review` on the whole diff → each rubric lane is
a `Task` subagent scoped to read only its SKILL.md + its file subset, returning findings in
the `Finding` JSON shape.

## 5. Severity, critical definition, and the gate

**Taxonomy — the repo's own, verbatim:** `CRITICAL | WARNING | SUGGESTION` from
`findings.ts`, category from `FindingCategory`, plus one added non-contract field `skill`
(which lane produced it).

Cross-scale mapping (`severity.md`):

| Source scale | → |
|---|---|
| `react-best-practices` CRITICAL/HIGH/MEDIUM | CRITICAL/WARNING/SUGGESTION |
| `security` skill confidence HIGH/MEDIUM/LOW | CRITICAL (if exploitable)/WARNING/**dropped** |
| `code-review` CONFIRMED/PLAUSIBLE | confidence 0.9/0.5; PLAUSIBLE capped at WARNING |
| deterministic invariants | CRITICAL, non-negotiable |

**CRITICAL rubric** — all three must hold: (a) in code the diff actually adds/modifies, (b)
confidence ≥ 0.8 with a traceable data/control path, and (c) matches one of: a reachable
correctness bug; attacker-controlled input reaching a sink / leaked secret / removed authz
check; a broken repo invariant (§5a below); a **new** layer-boundary violation that destroys
the onion-architecture test seam (the eight already-documented "Known violations" are
pre-existing and must not be re-reported unless the diff extends them); a migration/schema
hazard (destructive DDL without a guard, schema change with no matching migration).

### 5a. Deterministic invariants (`invariants.md`)

| ID | Check | Sev |
|---|---|---|
| INV-1 | `git diff --name-status "$BASE" -- server/src/db/migrations/` has any `M`/`D` (migrations are append-only) | CRITICAL |
| INV-2 | Any path under `server/src/vendor/shared/` or `client/src/vendor/` changed (do-not-touch) | CRITICAL |
| INV-3 | `server/src/db/schema/**` changed but no `A` under `server/src/db/migrations/` in the same diff | CRITICAL |
| INV-4 | Diff adds `.env*`, or a secret-shaped literal (`sk-`, `ghp_`, `AKIA`, 32+ char base64 assigned to `*KEY*`/`*SECRET*`/`*TOKEN*`) | CRITICAL |
| INV-5 | `server/package.json` appears in the diff (skip-worktree per TESTING.md) | WARNING |
| INV-6 | `e2e/specs/*.flow.json` uses the `chat` command or a non-`--url`/`--text`/`find` locator | WARNING |
| INV-7 | A DB-backed test imports `test/helpers/pg.ts` without the `.it.test.ts` suffix (would run in the unit lane, break CI) | CRITICAL |
| INV-8 | New cross-package source alias without the consuming workflow's `paths:` updated (path-filtered CI would silently skip it) | WARNING |
| INV-9 | New `.claude/skills/<x>/SKILL.md` added but `routing.md`/`.claude/skills/README.md` not updated | WARNING |
| INV-10 | New `client/src/**/utils.ts` / `client/src/constants/` / `client/src/utils/` (react-architecture forbids catch-alls) | WARNING |

### 5b. Waiver mechanism (added)

Without a way to knowingly accept a known/accepted finding, people reach for `--no-verify`
instead of fixing things, and the gate loses trust over time. Add
`.pr-self-review-ignore.json` (committed, reviewed like code) at repo root:

```json
[
  {
    "id": "onion-architecture:known-violation-4",
    "match": { "file": "server/src/modules/foo/routes.ts", "rule": "layer-boundary" },
    "reason": "pre-existing, tracked in TICKET-123",
    "author": "andrii",
    "added": "2026-08-07",
    "expires": null
  }
]
```

Phase 5 (normalize) filters any finding matching an entry's `file` + `rule`/`category` before
the gate runs. Waived findings still print in the report under a collapsed "Waived (N)"
section, never silently disappear from the summary. An entry with a past `expires` date is
ignored (treated as if absent) and flagged as "stale waiver — remove or renew" — this keeps
the file from becoming a permanent escape hatch. `INV-9`-style check: a new waiver entry
added in the same diff that also introduces the very finding it waives is flagged for extra
scrutiny in the report (self-waiving in one PR is a smell, not blocked, just called out).

## 6. Enforcement — "block from merging"

Four layers now (was three), weakest to strongest. Ship 1, 2, and the new 2b; 3 is opt-in.

**Layer 1 — in-session protocol.** On `REQUEST_CHANGES`, SKILL.md instructs Claude to refuse
`git push`/`gh pr create` in that session until CRITICAL findings are fixed and the skill
re-run, or the user gives an explicit `override: <reason>` (recorded in the stamp).

**Layer 2 — stamp file + local pre-push hook.** Run writes
`.devdigest/pr-self-review.json` (gitignored):

```json
{
  "head": "<sha>", "base": "<merge-base sha>",
  "files_hash": "<sha256 of sorted name-status output + untracked list>",
  "ran_at": "<iso8601>",
  "verdict": "APPROVE | COMMENT | REQUEST_CHANGES",
  "counts": { "CRITICAL": 0, "WARNING": 3, "SUGGESTION": 5 },
  "waived": 1,
  "skills_run": ["onion-architecture", "..."],
  "override": null
}
```

`scripts/pr-self-review-gate.sh` (deterministic, no model, exit 0/1) recomputes `files_hash`
and blocks if: stamp missing ("run /pr-self-review"); hash mismatch ("stale, changes since
last review"); `verdict == REQUEST_CHANGES` and `override == null` ("N critical findings").
Wired into:
- `.githooks/pre-push` (catches the user's own `git push`), installed via
  `git config core.hooksPath .githooks`, added idempotently to `scripts/dev.sh`.
- `.claude/settings.json` → `PreToolUse` hook on `Bash` calls containing `git push` or
  `gh pr create` (catches pushes Claude makes on the user's behalf); exit code 2 blocks the
  call and returns the reason to Claude so it self-corrects.

`git push --no-verify` bypasses this layer — it's a self-discipline tool, not a security
control.

**Layer 2b — CI parity check (added).** The local hook is bypassable with one flag, so it's
not a real merge block by itself. Add a lightweight GitHub Actions workflow,
`.github/workflows/pr-self-review-gate.yml`, triggered on `pull_request`, that re-runs
**only the deterministic invariants** (INV-1..INV-10, §5a) plus the waiver-file check —
no model call, no rubric lanes, so it's fast and free of LLM cost/flakiness in CI. It fails
the check if any INV is CRITICAL and unwaived. This is deliberately narrow: it is not a
re-run of the full multi-lane rubric review (that stays a local/interactive tool), just the
part that's cheap, deterministic, and worth having as a real, unbypassable gate on the PR
itself. Rubric-lane findings remain advisory at the CI layer — surfacing them there would
require a paid model call per PR, which is out of scope unless the user later asks for it
explicitly.

**Rollout (decided, §8 #11): ships as a non-required (observe-only) check first** —
comments/annotates the PR but does not block merge — and is only promoted to a required
branch-protection check after a trial period shows the invariants produce no false positives
on real PR diffs.

**Layer 3 — headless `claude -p` in pre-push.** Recommended **against** as default: a full
multi-lane review takes minutes and costs tokens on every push including trivial fixes,
blocks the terminal with no TTY for follow-up, needs `--output-format json` parsing
discipline, and a model failure/timeout becomes a push failure — and it can't fix anything
itself. Offered only behind `PR_SELF_REVIEW_AUTO=1`.

## 7. File layout

```
.claude/skills/pr-self-review/
  SKILL.md            # ≤150 lines: frontmatter + 6-phase protocol + verdict format
  routing.md          # §4 table — single source of truth for path→skill
  invariants.md       # §5a INV-1..INV-10 with the exact shell check for each
  severity.md         # taxonomy, CRITICAL rubric, cross-scale mapping, waiver rules
  report-format.md    # Finding JSON shape, report markdown template, stamp schema

.claude/commands/pr-self-review.md    # manual /pr-self-review trigger
.pr-self-review-ignore.json           # waiver file (new, committed)
scripts/pr-self-review-gate.sh        # deterministic stamp checker (exit 0/1)
.githooks/pre-push                    # calls the gate script
.claude/settings.json                 # NEW — PreToolUse hook on git push / gh pr create
.github/workflows/pr-self-review-gate.yml   # NEW — CI parity check (invariants only)
```

Edits to existing files: `.gitignore` (add `/.devdigest/`), `.claude/skills/README.md`
(catalog row, Scope = "Meta"), root `CLAUDE.md` ("Before opening a PR" section), `scripts/dev.sh`
(idempotent `git config core.hooksPath .githooks` line).

Frontmatter draft:

```yaml
name: pr-self-review
description: Self-review all local changes against this repo's own skill catalog before a
  pull request is opened. Use before running git push on a feature branch, before gh pr
  create, when the user says "review my changes", "am I ready to open a PR", "check this
  before I push", or asks for a pre-PR / self review — even if the skill isn't named. Routes
  each changed path to the matching project skills (UI files to the react/next skills,
  server and reviewer-core files to onion-architecture, fastify, drizzle, postgres), runs
  the built-in code-review and security-review over the whole diff, and blocks the push on
  any unwaived CRITICAL finding. Does not apply fixes.
```

## 8. Decisions (resolved 2026-08-07)

All items decided; all recommended defaults confirmed by the user.

| # | Question | Decision |
|---|---|---|
| 1 | Severity taxonomy | Reuse the repo's own `CRITICAL/WARNING/SUGGESTION` (`findings.ts` + `gateTriggered()`) |
| 2 | Pre-push behavior | Hard-block on CRITICAL; `--no-verify` remains the deliberate escape hatch |
| 3 | `code-review` effort level | `medium` default, `high` for `server/src/modules/**` / `reviewer-core/**` |
| 4 | Vendor paths (`server/src/vendor/shared`, `client/src/vendor/*`) | Any change to them is INV-2 CRITICAL; content read as context only, never reviewed as authored code |
| 5 | Can PLAUSIBLE-grade findings become CRITICAL? | No — always capped at WARNING, regardless of category |
| 6 | Typecheck/test alongside rubric review | `pnpm typecheck` always for touched packages; `pnpm test` only behind `--tests` (integration needs Docker) |
| 7 | Default latency/cost budget | Full multi-lane review by default (3–5 min); `--fast` (invariants + code-review only) is opt-in, not default |
| 8 | Gate scope | Fires on all pushes, including direct pushes to `main` |
| 9 | Install `gh` CLI? | Out of scope — PRs opened via GitHub web UI; pre-push hook already covers that path regardless of `gh` |
| 10 | Waiver entries require a ticket reference? | No — free-text `reason` + `author` + `added` date is sufficient paper trail for this project's size |
| 11 | CI parity check rollout | Ships first as **non-required/observe-only**; promote to a required branch-protection check only after a trial period shows no false positives on real diffs |

## 9. Step-by-step implementation

1. ~~Confirm decisions from §8~~ — done, see table in §8.
2. Write `routing.md` — §4 table verbatim, header noting it's the source of truth (INV-9
   enforces updates).
3. Write `severity.md` — taxonomy, CRITICAL rubric, cross-scale mapping, waiver rules (§5b).
4. Write `invariants.md` — INV-1..INV-10 as ID, rule, exact shell one-liner, severity,
   remediation sentence, citing root `CLAUDE.md`/`TESTING.md` per rule's origin.
5. Write `report-format.md` — `Finding` JSON shape (mirrors `findings.ts` + `skill` field),
   terminal report template (grouped by severity then skill, `file:line` links, a "Waived
   (N)" collapsed section), stamp-file JSON schema.
6. Create `.pr-self-review-ignore.json` — empty array `[]` to start, with a short top-of-file
   comment-equivalent (a `"_readme"` string field, since JSON has no comments) explaining the
   schema.
7. Write `SKILL.md` — frontmatter from §7, 6-phase protocol: (1) diff via §3 commands, (2)
   invariants, (3) routing, (4) parallel lane dispatch, (5) normalize + dedupe + waiver
   filter, (6) verdict + report + stamp. ≤150 lines, detail pushed to siblings.
8. Write `.claude/commands/pr-self-review.md`, modeled on
   `.claude/commands/engineering-insights.md`; full multi-lane review is the default (§8 #7),
   supports `--base <ref>` and an opt-in `--fast` (invariants + code-review only).
9. Write `scripts/pr-self-review-gate.sh` — POSIX sh, `git`/`shasum`/`jq` only (no Python —
   this script runs on every `git push`, so it can't assume an interpreter beyond what
   `pr-self-review-hook.sh` already requires), exit 0/1 with one-line stderr reason,
   independently runnable without a model. Mark executable.
10. Add `.githooks/pre-push` (5-line wrapper, honours `PR_SELF_REVIEW_SKIP=1`); add the
    idempotent `git config core.hooksPath .githooks` line to `scripts/dev.sh`.
11. Create `.claude/settings.json` with the `PreToolUse` hook (matcher `Bash`, filtered to
    commands containing `git push`/`gh pr create`, exit 2 blocks + feeds reason back).
    File doesn't exist yet — create minimally, no unrelated settings.
12. Add `.github/workflows/pr-self-review-gate.yml` — `pull_request` trigger, checks out the
    PR diff, runs only the INV-1..INV-10 shell checks + waiver-file lookup, annotates/comments
    on any unwaived CRITICAL. **Ship as non-required (observe-only)** per §8 #11 — do not wire
    into branch protection yet; revisit after a trial period with no false positives.
13. Update `.gitignore` (`/.devdigest/`), `.claude/skills/README.md` (catalog row), root
    `CLAUDE.md` ("Before opening a PR" section: run `/pr-self-review`; pushes gated on
    unwaived CRITICAL; `PR_SELF_REVIEW_SKIP=1`/`--no-verify` to bypass locally, waiver file
    to bypass permanently with a paper trail).
14. Smoke-test on a branch with a real diff: run `/pr-self-review --base main`, verify
    routing picked the expected lanes, stamp written, `pr-self-review-gate.sh` exits 0; touch
    a file, confirm it now exits 1 as stale.
15. Negative-test the invariants (scratch edit under `server/src/db/migrations/`, confirm
    INV-1 fires CRITICAL and the gate blocks; revert). Add one waiver entry for it, confirm
    the gate passes and the report shows it under "Waived (1)".
16. Negative-test the CI workflow on a throwaway PR touching a migration file without a
    waiver — confirm the Action fails; add a waiver — confirm it passes.
17. Run `/engineering-insights` to capture anything learned, per repo convention.

## 10. Critical files for implementation

- `server/src/vendor/shared/contracts/findings.ts` — `Severity`/`FindingCategory`/`Finding`/
  `Review` contract to normalize every lane's output into (read-only, do-not-touch vendored)
- `reviewer-core/src/output/to-review.ts` — `SEV_RANK`, `FAIL_ON_MIN_RANK`, `gateTriggered`,
  `countBlockers`; the exact gate semantics to mirror
- `.claude/skills/onion-architecture/SKILL.md` — house style for a repo-specific skill
  (frontmatter phrasing, `references.md`/`examples.md` split, "Known violations" table the
  backend lane must not re-report)
- `.claude/commands/engineering-insights.md` — template for the `/pr-self-review` command
- `CLAUDE.md`, `TESTING.md` — source of record for invariants INV-1, INV-2, INV-5, INV-6,
  INV-7, INV-8
- `.github/workflows/*.yml` — existing path-filtered CI pattern to follow for the new
  `pr-self-review-gate.yml`
