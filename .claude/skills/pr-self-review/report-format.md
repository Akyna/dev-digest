# Finding shape, report template, stamp schema

## Finding (normalized, per severity.md)

Every lane's output — rubric lane, `code-review`, `security-review`, or a deterministic
invariant hit — is normalized into this shape before the gate runs:

```ts
{
  id: string,              // stable per (skill, file, start_line, title) — used by waiver matching
  severity: 'CRITICAL' | 'WARNING' | 'SUGGESTION',
  category: 'bug' | 'security' | 'perf' | 'style' | 'test',
  title: string,
  file: string,             // repo-relative path
  start_line: number,
  end_line: number,
  rationale: string,        // markdown, why this is a problem
  suggestion?: string,      // markdown, optional concrete fix
  confidence: number,       // 0..1
  skill: string,            // which lane produced this — 'onion-architecture', 'code-review', 'INV-3', ...
  waived?: { reason: string; author: string; added: string },
}
```

This mirrors `server/src/vendor/shared/contracts/findings.ts`'s `Finding` field-for-field
(minus the lethal-trifecta-only fields, which don't apply here) plus the added `skill` and
`waived` fields.

## Deduplication (phase 5, before the gate)

Two findings are the same finding if they share `file`, overlapping `[start_line, end_line]`,
and `category`. When that happens: keep the higher-severity one, merge `skill` into a list
(`"onion-architecture, code-review"`), keep the longer `rationale`.

## Terminal report template

```
# pr-self-review — <verdict emoji> <APPROVE | COMMENT | REQUEST_CHANGES>

<N> finding(s) · <C> critical · <W> warning · <S> suggestion · <X> waived
Base: <base-ref> (<sha>)  ·  Lanes run: <skill1>, <skill2>, code-review, security-review

## 🔴 Critical (<C>)
- **<title>** — `<file>:<start_line>`  [<skill>]
  <rationale>
  _Suggestion:_ <suggestion>

## 🟡 Warning (<W>)
- ...

## 🔵 Suggestion (<S>)
- ...

## Waived (<X>)
- **<title>** — `<file>:<start_line>`  [<skill>] — waived: <reason> (<author>, <added>)

---
<if REQUEST_CHANGES>
**Push is blocked.** Fix the critical finding(s) above and re-run `/pr-self-review`, or add
an explicit `override: <reason>` this session, or add a waiver entry to
`.pr-self-review-ignore.json` with a paper trail.
```

Grouping and the severity-counts line intentionally mirror `severityCounts()` /
`composeBody()` in `reviewer-core/src/output/to-review.ts`, so a `pr-self-review` report and
an actual posted PR review read the same way.

## Stamp file — `.devdigest/pr-self-review.json`

Written at the end of every run (gitignored — see `.gitignore`). Read by
`scripts/pr-self-review-gate.sh`.

```json
{
  "head": "<sha of HEAD at run time>",
  "base": "<merge-base sha with main>",
  "files_hash": "<sha256 of diff CONTENT — see the exact recipe in SKILL.md phase 6; must match scripts/pr-self-review-gate.sh's current_hash() byte-for-byte>",
  "ran_at": "<ISO 8601 timestamp>",
  "verdict": "APPROVE | COMMENT | REQUEST_CHANGES",
  "counts": { "CRITICAL": 0, "WARNING": 0, "SUGGESTION": 0 },
  "waived": 0,
  "skills_run": ["<skill>", "..."],
  "override": null
}
```

`override`, when set, is a string the user typed in-session (`override: <reason>`) — the gate
script treats a `REQUEST_CHANGES` stamp with a non-null `override` as passing, but the reason
stays on record in the stamp for later inspection.

`files_hash` is what makes the stamp self-invalidating: it hashes actual diff *content*, not
just the changed-file list, so any edit since the last run — a new file, a reverted file, or
further changes to a file already reviewed this run — changes the hash, and the gate script
reports "stale, changes since last review" instead of trusting an old pass. A name/status-only
hash would let a stamp stay valid after content changed underneath it — that was a real gap
found and fixed while dogfooding this skill on its own diff; see
`docs/pr-self-review-plan.md`.
