# Conventions extractor — data & pipeline

Turns a cloned repo into a reviewable, editable Skill: sample → deterministic
signals + 2-step LLM proposal → verify (ground every candidate against real
file content) → accept/reject/edit → assemble a markdown skill body
(`source: 'extracted'`).

## Where the code lives

```
sampling.ts   → config globs + repo-intel top-ranked files, byte-capped
signals.ts    → deterministic config-parse pass, confidence 1.0, no model call
prompts.ts    → ConventionFileSelection / ConventionExtraction schemas + messages
service.ts    → orchestrates sampling → signals → 2-step LLM → verify → persist
verify.ts     → the only code allowed to keep a candidate (kept/dropped, like
                reviewer-core/src/grounding.ts but grounded on file content)
helpers.ts    → buildSkillBody / suggestSkillName / DTO mapping
repository.ts → conventions CRUD, pending-only replace on re-scan
routes.ts     → extract / list / patch / skill-draft / skill
```

The quality contract: **the model only proposes, verify.ts decides.** No
candidate reaches the DB — and so never reaches the UI — without a literal
`file:line` match in the sampled clone.

## Ideas not built here (future work)

- **Mine git history** — commits that touch the same file repeatedly with a
  similar diff shape are a convention signal independent of any single
  snapshot (e.g. "every new route handler also gets an entry in `routes.ts`").
- **Mine existing findings / PR comments** — a rule reviewers keep repeating in
  `findings.rationale` or human PR comments is a convention nobody wrote down;
  cluster past findings by category and propose the pattern as a candidate.
- **Counter-example search** — before trusting a rule, actively search the
  sample for a file that violates it. A rule with exceptions should ship at
  lower confidence than one with none, not the same confidence as `signals.ts`
  emits today.
- **Synthesize ast-grep rules from an accepted convention** — once a user
  accepts "use camelCase for variables", generate a runnable ast-grep pattern
  so the same convention becomes an automatic lint gate, not just review-time
  prose.
- **Arbitration by a stronger model** — run the cheap extraction pass by
  default (current behaviour), then re-score only the borderline-confidence
  candidates with a stronger model before they reach the UI.
- **Learn from rejected candidates** — feed a workspace's reject history back
  into the extraction prompt ("candidates like X have been rejected before")
  so repeat scans stop re-proposing rules the user has already said no to.
- **Eval loop on a fixed repo** — a small `eval_cases` set (owner_kind:
  'skill') pinned to one known repo, so a prompt/model change to this module
  can be scored for precision/recall before it ships, the same way
  `docs/agent-prompts/README.md` asks of review-facing prompts.
