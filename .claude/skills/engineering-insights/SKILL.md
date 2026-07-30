---
name: engineering-insights
description: Reads and updates non-obvious engineering learnings scoped to each package's own INSIGHTS.md (client/, server/, reviewer-core/, e2e/). Use at the start of any task touching one of these packages, to read its INSIGHTS.md before writing code. Use at the end of any substantial session in this repo to append genuinely new, non-duplicate findings — skip entirely if nothing substantial was learned.
---

# Engineering Insights

Turns each package's `INSIGHTS.md` into a working memory loop instead of a
static file: read it before touching a package, update it — only when
something real was learned — before the session ends. See `examples.md` for
vague-vs-useful entry pairs and `references.md` for where this design comes
from.

## Module detection

Map the files touched in this session to one of the four packages by path
prefix: `client/`, `server/`, `reviewer-core/`, `e2e/`. A session touching
multiple packages reads and writes each touched package's own `INSIGHTS.md`
separately — never copy an entry across packages. Work that isn't clearly
scoped to one of these four (root scripts, `README.md`, `docker-compose.yml`)
is out of scope for this skill: no root `INSIGHTS.md` exists and none should
be created.

## Start-of-task protocol

Before making any change in a package, read that package's `INSIGHTS.md` in
full and briefly state the top relevant points for the task at hand. This
isn't optional busywork — stating it back is what forces the content to
actually get used instead of skimmed, and it's a cheap sanity check that the
file was read at all. If the file has no entries yet, say so in one line and
continue.

## The 7 sections

Every entry belongs in exactly one of these; when a discovery would fit more
than one, prefer **What Doesn't Work** or **Recurring Errors & Fixes** — bugs
and dead ends are consistently the highest-signal content a package's notes
can hold.

| Section | What goes here |
|---|---|
| What Works | A pattern or approach that worked, worth repeating |
| What Doesn't Work | A dead end / antipattern and why it fails |
| Codebase Patterns | Conventions or architectural decisions specific to this package |
| Tool & Library Notes | Dependency quirks, version gotchas |
| Recurring Errors & Fixes | An error signature, its root cause, its fix |
| Session Notes | A dated one-line summary of what a session touched, when nothing else fits cleanly |
| Open Questions | Unresolved, needs a human decision |

## Signal priority — what's worth capturing at all

Not everything noticed during a session clears the bar. Rank candidates,
highest signal first, and require a higher bar to justify writing the lower
ones:

1. **User correction** — the user explicitly redirected an approach the
   agent took. Almost always worth recording.
2. **Failed or worked-around approach** — something was tried, didn't work,
   and a different approach was needed.
3. **Recurring pattern or mistake** — the same thing came up more than once
   in this session (or matches something half-remembered from a prior one).
4. **One-off error and its fix** — a specific error message/stack trace and
   what resolved it.
5. **Workflow pattern** — a multi-step sequence that worked, worth
   remembering as a unit.

## Quality bar

Two complementary tests, both must pass:

- **Obviousness test**: if this would be obvious to anyone reading the code,
  don't write it.
- **Value test**: would this save 5+ minutes next time someone hits it?

See `examples.md` for concrete vague-vs-useful pairs.

## End-of-session wrap-up protocol

This is exactly what `/engineering-insights` also runs on demand.

1. Determine which package(s) were touched this session.
2. For each touched package, re-read its **current** `INSIGHTS.md` — not
   just what was read at session start, it may have changed — and for each
   candidate entry run the dedup check:
   `python3 .claude/skills/engineering-insights/scripts/check_duplicate.py <path-to-INSIGHTS.md> "<candidate entry text>"`
   Drop any candidate the script reports as `LIKELY_DUPLICATE`.
3. Rank the surviving candidates by signal priority (above); keep at most 5
   per package per wrap-up. If a section already has ~30+ entries, don't add
   more silently — flag it to the user as a candidate for a manual
   consolidation pass instead of growing it further unchecked.
4. If nothing survives steps 2-3, say so explicitly in one line and write
   nothing. Do not force an entry just to have written something.
5. Otherwise, append one entry per surviving candidate to the correct
   section, format:
   ```
   ## YYYY-MM-DD — short title
   1-3 lines: what happened / why it matters, with a file:line reference
   where applicable.
   ```
   Append-only — never edit or delete an existing entry. To correct a stale
   one, add a new dated entry noting the correction; don't rewrite history.
6. Report a terse one-line-per-action summary, e.g.:
   ```
   Updated server/INSIGHTS.md — added Recurring Errors & Fixes entry (rate-limit retry loop)
   Skipped: client caching note (already documented)
   ```
   or, if nothing qualified: `No new insights this session.`
