# References

Sources actually fetched and read while designing this skill (not a
re-statement of a pasted summary). Where sources disagreed, this skill takes
an explicit side — noted below rather than silently averaged.

## Primary structural precedent

- **`github.com/glebis/claude-skills`** — `retrospective/SKILL.md` +
  `retro_engine.py` (30 passing pytest tests). Real, working implementation
  of a near-identical use case. Adopted directly: signal-priority ranking
  (user correction > failed approach > recurring pattern > one-off error >
  workflow pattern), term-overlap duplicate detection before proposing an
  entry (`scripts/check_duplicate.py` here is adapted from its dedup
  function), a hard cap on entries written per wrap-up, and "never write into
  the skill's own file — distribute to the target(s) actually touched."

## MindStudio — Learnings.md / wrap-up pattern (6 articles)

`self-learning-ai-skill-system-learnings-md-wrap-up`,
`how-to-build-learnings-loop-claude-code-skills`,
`compounding-knowledge-loop-claude-code`,
`self-learning-claude-code-skill-learnings-md`,
`self-evolving-claude-code-memory-obsidian-hooks`,
`what-is-claude-code-auto-memory` (all mindstudio.ai/blog).

Adopted: the 7-section file structure, the "confirm you've read X, summarize
top 3" active-read pattern, the obviousness/specificity quality bar.

**Where they disagree (and what this skill picked):** trigger mechanism
(manual command vs. automated `Stop` hook vs. autonomous judgment — this
skill uses auto-skill + manual `/engineering-insights` command, no hook, per
course sequencing); whether to write even when nothing new was found (one
article says always update — this skill explicitly does not, per the
project's requirement to skip when nothing substantial happened); prune
cadence (quarterly / 80-100 entries / weekly / 90 days — no consensus, this
skill uses a ~30-entry flag as the closest thing to a shared number, borrowed
from the dev.to source below).

## dev.to

- `evoleinik/claudemd-building-persistent-memory-for-ai-coding-agents` —
  source of the "would this save 5+ minutes next time?" test and the
  ~30-entries cap / monthly review cadence.
- `aviad_rozenhek_cba37e0660/self-improving-ai-...` — source of the
  reflect-abstract-write trigger phrasing and NEVER/ALWAYS-style directive
  framing (not directly used here since entries are dated notes, not rules,
  but informed the quality-bar wording).

## Official Anthropic

- `claude.com/blog/lessons-from-building-claude-code-how-we-use-skills` —
  "skills are folders, not just markdown files"; skills can register dynamic
  session-scoped hooks (not used here — deferred to a later lesson); "the
  highest-signal content in any skill is the Gotchas section," which is why
  What Doesn't Work / Recurring Errors & Fixes are called out as priority
  sections above.
- `platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`
  — frontmatter constraints (`name` ≤64 chars/lowercase+hyphens/no
  claude|anthropic, `description` ≤1024 chars/third-person/what+when),
  SKILL.md under ~500 lines, references one level deep, and the
  "degrees of freedom" framework that justifies `check_duplicate.py` as a
  script rather than a prose-only instruction.

## Dead links from the original research (not used)

- Two `mcpmarket.com` listing pages returned HTTP 429 (bot-protected) on
  every fetch attempt — only unverified search-result snippets were
  available, so nothing from them is cited above.
- `glama.ai/mcp/servers/@omega-memory/Omega/blob/main/docs/reddit-drafts.md`
  does not exist — the real `omega-memory/omega-memory` repo's `docs/` tree
  was enumerated directly and contains no such file. Treat this link as
  unreliable if it resurfaces.
