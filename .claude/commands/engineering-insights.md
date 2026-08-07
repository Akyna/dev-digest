---
description: Run the engineering-insights end-of-session wrap-up now — a guaranteed check instead of waiting for the skill to self-invoke
---

Run the **end-of-session wrap-up protocol** from the `engineering-insights`
skill (`.claude/skills/engineering-insights/SKILL.md`) right now, for this
session so far:

1. Determine which package(s) (`client/`, `server/`, `reviewer-core/`,
   `e2e/`) were touched this session.
2. For each touched package, re-read its current `INSIGHTS.md` and run
   `python3 .claude/skills/engineering-insights/scripts/check_duplicate.py <path-to-INSIGHTS.md> "<candidate text>"`
   for each candidate insight, dropping anything reported as
   `LIKELY_DUPLICATE`.
3. Rank the survivors by signal priority (user correction > failed approach
   > recurring pattern > one-off error/fix > workflow pattern), keep at most
   5 per package, and apply the quality bar (obviousness test + "would this
   save 5+ minutes?") from `examples.md`.
4. If nothing survives, say so in one line and write nothing — don't force
   an entry.
5. Otherwise append one entry per survivor to the correct section of the
   right package's `INSIGHTS.md`, append-only, dated, `file:line` where
   applicable.
6. Report a terse one-line-per-action summary of what was written (or
   confirm nothing new was found).
