/**
 * Built-in reviewer SKILLS used by the seed.
 *
 * A skill is a small, reusable rubric that gets injected into an agent's prompt
 * as one `### <name>` block under `## Skills / rules`
 * (`ReviewRunExecutor.buildSkillBlocks` → `assemblePrompt`). Where a system
 * prompt says what KIND of reviewer the agent is, a skill says what to check on
 * a specific class of change — so the same rubric can be attached to several
 * agents and reordered without rewriting a prompt.
 *
 * Two fields matter for different readers:
 * - `description` is the skill's INTERFACE — it is what a human (and later, a
 *   selector) reads when deciding whether to attach the skill. Write it
 *   directively ("Use when the diff …"), never as a summary of the body.
 * - `body` is what the model actually receives. Directive markdown: a heading,
 *   then concrete, checkable rules — not prose about testing philosophy.
 *
 * `source` is a TRUST marker, not provenance trivia: `manual` / `extracted`
 * bodies are rendered as trusted text, while `imported_url` / `community`
 * bodies are fenced inside `<untrusted source="skill:…">` because they are
 * somebody else's instructions sitting in our prompt.
 */

export const BRANCH_COVERAGE_GATE_BODY = `# Branch coverage gate

Every branch this diff INTRODUCES needs a test that drives it and asserts the
outcome. Walk the diff and list them, then look for the test:

- Each new \`if\` and its \`else\` (including the implicit "condition false" path).
- Each new \`catch\` / \`.catch()\` / rejection handler, and the throw that reaches it.
- Each new early return, guard clause, or \`throw\` in a validation position.
- Each new \`switch\` case, including \`default\`.
- Each new short-circuit that changes behaviour (\`??\`, \`||\`, \`?.\` on a value that
  can genuinely be nullish).

Rules:
- A branch is covered only when a test reaches it AND asserts the observable
  result — the returned value, the thrown error type/message, the persisted row,
  the HTTP status. Reaching a line without asserting anything is not coverage.
- Happy-path-only is a finding. If the diff adds an error path and the new tests
  only exercise success, say which input reaches the untested branch and what
  would go undetected.
- Name the branch by file and line, and name the test that should have covered
  it (or state that none does). "Add more tests" is not a finding.
- One finding per untested behaviour. If a whole new module arrives with no test
  file at all, that is ONE finding, not one per branch.
- Pre-existing untested branches are out of scope unless this diff extends or
  changes them.`;

export const EDGE_CASE_CHECKLIST_BODY = `# Edge-case checklist

Run the changed code against this list. Report a case only when it is reachable
through the changed code path AND the behaviour there is wrong, undefined, or
untested — not merely absent from the tests' names.

- **Empty**: \`[]\`, \`''\`, \`{}\`, a zero-row query result, an empty file, an empty
  page of results. Distinguish "empty" from "missing": an empty array is truthy.
- **Absent**: \`null\` vs \`undefined\` vs a missing property vs a present-but-falsy
  one. Check \`??\` where \`||\` would swallow \`0\` / \`''\` / \`false\`.
- **Zero and negative**: \`0\`, \`-1\`, \`-0\`, \`NaN\` from a failed parse, a negative
  limit/offset/page, a count that can go below zero.
- **Boundaries**: first and last element, min/max allowed value, exactly-at-limit
  vs one-over, inclusive/exclusive range ends, off-by-one on slices and pagination.
- **Collections**: single element, duplicates, ordering assumptions, very large
  input, an item appearing twice under different keys.
- **Concurrency**: two callers racing the same row or cache key, a read-then-write
  gap (TOCTOU), a retry that re-applies a non-idempotent effect, out-of-order
  completion.
- **Time**: a timeout expiring mid-flight, a cancellation/abort arriving after the
  work started, clock skew, DST and timezone, an expiry exactly at "now".
- **Text and encoding**: unicode (emoji, combining marks, RTL), a string whose
  \`.length\` differs from its visible length, very long input, leading/trailing
  whitespace, case differences on a key.
- **Untyped boundaries**: an HTTP body, DB row, env var, or third-party payload
  whose type is asserted but never validated.

For each reported case, state the concrete input and the wrong outcome it
produces. A case that is already handled elsewhere in the changed path is not a
finding.`;

export const OVER_MOCKING_GUARD_BODY = `# Over-mocking guard

A mock replaces a dependency; it must never replace the thing under test. When
it does, the test asserts the mock's own behaviour and passes on broken code.

Flag these:
- The unit under test — or a function it calls in the SAME module — is mocked,
  spied, or stubbed. The assertion then proves only that the stub was configured.
- The test asserts only that a mock was called (\`toHaveBeenCalled\`,
  \`toHaveBeenCalledTimes\`) when the real question is what value was returned,
  what was persisted, or what the caller sees.
- A stub returns a shape the real dependency no longer returns. Mock drift makes
  the suite green while production breaks — check the stub against the real
  signature in the diff.
- Mocks pinned to exact internal call sequences or argument objects that a
  behaviour-preserving refactor would break.
- A whole module auto-mocked to silence one awkward call.

Mock ONLY at real boundaries — the places you do not own or cannot control:
- network / HTTP clients, third-party SDKs, LLM providers,
- the clock, timers, and randomness (inject or fake them; do not sleep),
- the filesystem and subprocesses,
- and nothing else. Prefer a real in-memory instance or a fixture over a stub for
  code you own.

When reporting, name the mocked symbol, say what the test is left asserting, and
name the mutation of the production code that would still pass.`;

export const FLAKY_TEST_SMELLS_BODY = `# Flaky test smells

A test that fails once a week costs more than the bug it catches: it trains the
team to re-run CI instead of reading failures. Flag these patterns in tests the
diff adds or changes.

- **Sleeps**: \`sleep\`, \`setTimeout\` in a test body, or a fixed \`await\` delay used
  to "let it settle". Wait on the condition (poll with a deadline, await the
  promise, use fake timers) instead of on the clock.
- **Real clock**: \`Date.now()\` / \`new Date()\` compared against a value the code
  also computes, assertions on elapsed time, expiry windows measured in real
  seconds, dependence on the machine's timezone, locale, or DST.
- **Unseeded randomness**: \`Math.random()\`, \`crypto.randomUUID()\`, faker without a
  fixed seed, or a random port — anything that makes a failure impossible to
  reproduce from the log.
- **Order dependence**: a test that reads state a previous test wrote, relies on
  file or declaration order, or breaks when run alone or with \`.only\`.
- **Shared mutable fixtures**: a module-level object, array, Map, or DB row
  mutated by several tests; a singleton or module cache never reset between cases.
- **Missing cleanup**: fake timers not restored, spies not reset, listeners and
  intervals left running, temp files/dirs or DB rows not removed, an open handle
  that keeps the process alive.
- **Real I/O**: an unmocked network call, a live external service, or a
  filesystem write outside a per-test temp dir.
- **Racy assertions**: asserting on a value produced by an unawaited promise, or
  a callback assumed to have run by the end of the test body.

Cite the exact line with the smell and say what makes it non-deterministic.`;

export const API_CONTRACT_GATE_BODY = `# API contract gate

A published route, DTO, or status code is a promise to callers you cannot
redeploy. Any change to one is BREAKING unless the diff also ships a migration
path. Check every changed HTTP handler, route schema, response type, and shared
contract.

Breaking without a migration path — report it:
- A new REQUIRED request field, query param, header, or path segment (an existing
  caller omits it and now fails).
- Removing or renaming a response field, or changing its type or nullability
  (\`string\` → \`string | null\` breaks every caller that does not check).
- Removing or renaming a route, changing its method, or moving it under a new
  prefix.
- Changing a status code for an existing outcome (200 → 204, 200 → 400 on input
  that used to be accepted, a redirect where a body was returned).
- Tightening validation so previously accepted input is now rejected — a stricter
  enum, a shorter max length, a newly enforced format.
- Changing pagination shape, default page size, sort order, or the meaning of a
  cursor.
- Changing error shape or error codes that callers branch on.

What makes it acceptable:
- A new API version or route alongside the old one, with the old path still
  serving its previous contract.
- The new field/param being OPTIONAL with a default that preserves today's
  behaviour.
- Additive-only changes: a new optional response field, a new endpoint, a widened
  accepted input.
- A named consumer migration in the diff (updated client/SDK/fixtures) AND a
  deprecation window, for an internal-only contract.

For each finding, name the exact contract element that changed, the caller
behaviour that breaks, and which of the acceptable paths above is missing. If the
route is demonstrably new in this same diff, there is no contract to break —
do not report it.`;

/** The five starter skills, in the shape `skills` rows are inserted with. */
export const SEED_SKILLS = [
  {
    name: 'branch-coverage-gate',
    description:
      'Use when the diff adds or changes conditional logic (if/else, catch, early return, switch). Checks that every newly introduced branch has a test that drives it and asserts the outcome; flags happy-path-only test suites.',
    type: 'rubric' as const,
    source: 'manual' as const,
    body: BRANCH_COVERAGE_GATE_BODY,
  },
  {
    name: 'edge-case-checklist',
    description:
      'Use when the diff adds input handling, parsing, ranges, pagination, or concurrent/timed work. Walks a fixed checklist — empty, null/undefined, 0 and -1, range boundaries, concurrency, timeouts, unicode — against the changed path.',
    type: 'rubric' as const,
    source: 'manual' as const,
    body: EDGE_CASE_CHECKLIST_BODY,
  },
  {
    name: 'over-mocking-guard',
    description:
      'Use when the diff adds or changes tests that mock, stub, or spy. Detects tests that mock the unit under test (and therefore assert nothing) and mocks placed anywhere other than a real boundary — network, clock, filesystem, subprocess.',
    type: 'convention' as const,
    source: 'manual' as const,
    body: OVER_MOCKING_GUARD_BODY,
  },
  {
    name: 'flaky-test-smells',
    description:
      'Use when reviewing any added or changed test file. Flags non-determinism that will intermittently fail CI: sleeps, real clocks, unseeded randomness, order-dependent tests, shared mutable fixtures, and missing cleanup.',
    type: 'convention' as const,
    source: 'imported_url' as const,
    body: FLAKY_TEST_SMELLS_BODY,
  },
  {
    name: 'api-contract-gate',
    description:
      'Use when the diff changes an HTTP route, request/response DTO, validation schema, or status code. Treats any narrowing or renaming as breaking unless the diff ships versioning, an optional-with-default field, or a named consumer migration.',
    type: 'security' as const,
    source: 'manual' as const,
    body: API_CONTRACT_GATE_BODY,
  },
];
