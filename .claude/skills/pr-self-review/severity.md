# Severity — taxonomy, CRITICAL rubric, cross-scale mapping

## Taxonomy — the repo's own, verbatim

`pr-self-review` does not invent a new severity scale. It normalizes every lane's output
into the product's own contract, `server/src/vendor/shared/contracts/findings.ts`:

- `Severity = 'CRITICAL' | 'WARNING' | 'SUGGESTION'`
- `FindingCategory = 'bug' | 'security' | 'perf' | 'style' | 'test'`

Plus one field the contract doesn't have, added for this skill only: `skill` — which lane
produced the finding (e.g. `"onion-architecture"`, `"code-review"`).

The gate itself mirrors `reviewer-core/src/output/to-review.ts` exactly:
`SEV_RANK = { SUGGESTION: 1, WARNING: 2, CRITICAL: 3 }`, and a run is blocked when any
unwaived finding's rank is `>= FAIL_ON_MIN_RANK['critical']` (i.e. any `CRITICAL`).

## Cross-scale mapping

Project skills and built-ins each have their own internal vocabulary. Map into the taxonomy
above at normalization time (`SKILL.md` phase 5):

| Source scale | → |
|---|---|
| `react-best-practices` CRITICAL / HIGH / MEDIUM | CRITICAL / WARNING / SUGGESTION |
| `security` skill confidence HIGH / MEDIUM / LOW | CRITICAL (only if concretely exploitable) / WARNING / **dropped** (never reported — mirrors that skill's own "LOW confidence → do not report" rule) |
| built-in `code-review` verdict CONFIRMED / PLAUSIBLE | maps to **confidence**, not severity: `CONFIRMED → 0.9`, `PLAUSIBLE → 0.5` |
| deterministic invariants (`invariants.md`) | fixed severity per invariant, non-negotiable — no model judgment involved |
| any lane with no explicit severity language | default to WARNING unless it clears the CRITICAL rubric below |

## Hard rule: confidence gates severity

**Only findings with confidence ≥ 0.8 may be CRITICAL.** A `PLAUSIBLE`-equivalent finding
(confidence 0.5) is capped at WARNING and can never block the gate — this was an explicit
decision (see `docs/pr-self-review-plan.md` §8 #5): speculative findings must never block a
push. This is the direct analogue of the `security` skill's own "LOW confidence → do not
report" rule.

## The CRITICAL rubric

A finding is CRITICAL only if **all three** hold:

1. **In changed code.** It's in a hunk the diff actually adds or modifies — never in
   pre-existing code the diff merely touches nearby.
2. **High confidence, traceable.** Confidence ≥ 0.8, with a concrete data/control-flow path —
   not a style preference or "this could theoretically...".
3. **Matches one of:**
   - A correctness bug reachable on a normal path (crash, wrong result, data loss, unhandled
     rejection in a route).
   - Security: attacker-controlled input reaching a sink; a secret/token committed; an authz
     check removed or bypassed.
   - A broken repo invariant — see `invariants.md`.
   - A **new** onion-architecture layer-boundary violation that destroys the test seam (a
     route reaching `container.db` / `await container.github()` directly). The eight
     violations already documented in onion-architecture's "Known violations" table are
     pre-existing and must **not** be re-reported unless the diff extends them.
   - A migration/schema hazard: destructive DDL with no guard, or a schema change with no
     matching migration (also covered deterministically by INV-3).

Everything else — style, minor perf, missing test coverage, placement quibbles — is WARNING
or SUGGESTION. When in doubt, a lane should under-call CRITICAL, not over-call it: a missed
WARNING costs a follow-up comment; a false CRITICAL blocks a push and burns trust in the gate.

## Waivers

See `.pr-self-review-ignore.json` at repo root and phase 5 of `SKILL.md`. A finding matched
by a waiver entry is excluded from the gate calculation but still printed in the report under
a collapsed "Waived (N)" section — waivers make findings non-blocking, never invisible. An
entry whose `expires` date has passed is treated as absent (the finding blocks again) and the
report calls it out as "stale waiver — remove or renew".
