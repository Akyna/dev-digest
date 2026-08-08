# Deterministic invariants

No model judgment required — pure `git`/`grep`, run in phase 2 of `SKILL.md` before any
lane is dispatched. Cheap (~50ms total) and the highest-value CRITICALs in the whole skill,
because they encode rules this repo has already stated explicitly (root `CLAUDE.md`,
`TESTING.md`) rather than rules a model has to rediscover from context each time.

Each check runs against `$BASE` (the merge-base with `main`, computed in `SKILL.md` phase 1)
and the full `CHANGED[]` list (tracked + untracked).

**`git diff --name-status "$BASE" -- <path>` alone misses untracked new files** (a file
`git add` hasn't touched yet doesn't appear in `git diff` output at all, against any ref).
Any check that asks "does path X exist in this diff" — not just "was a tracked file at path X
modified" — must union it with `git ls-files --others --exclude-standard -- <path>`. Below,
`changed(<path>)` means exactly that union (untracked files count as status `A`); plain
`git diff --name-status` is used only where the check specifically needs `M`/`D` status
(INV-1), which by definition only applies to already-tracked files.

```sh
changed() {  # changed <pathspec...> — prints "STATUS<TAB>path" for tracked + untracked
  git diff --name-status "$BASE" -- "$@"
  git ls-files --others --exclude-standard -- "$@" | sed 's/^/A\t/'
}
```

| ID | Rule | Check | Severity | Origin |
|---|---|---|---|---|
| INV-1 | Applied migrations are append-only — never edit or delete one | `git diff --name-status "$BASE" -- server/src/db/migrations/ \| grep -qE '^[MD]'` → match (untracked-file union not needed — a brand-new migration is never `M`/`D`) | CRITICAL | root `CLAUDE.md` "Do-not-touch" |
| INV-2 | `server/src/vendor/shared/**` and `client/src/vendor/*` are vendored — edit at source, not here | `changed server/src/vendor/shared client/src/vendor \| grep -q .` → match | CRITICAL | root `CLAUDE.md` "Do-not-touch" |
| INV-3 | A schema change must ship with a matching migration | `changed server/src/db/schema server/src/db/schema.ts \| grep -q .`, **and** `changed server/src/db/migrations/ \| grep -qE '^A'` fails (no added migration) | CRITICAL | Drizzle workflow convention — a schema-only change means `db:migrate` was never run against a generated migration |
| INV-4 | No secrets committed | `changed . \| grep -E '\.env($\|\.[a-z]+$)' \| grep -v '\.env\.example'` → match (rare in practice — `.env*` is gitignored, so this only fires on a force-added file), **or** a line matching a secret-shaped literal (`sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{30,}`, `AKIA[A-Z0-9]{16}`, or a 32+ char base64/hex value assigned to an identifier containing `KEY`, `SECRET`, or `TOKEN`) anywhere in the added lines of tracked **or** untracked changed files | CRITICAL | general hygiene; reinforced by server's `secrets.json`-not-`.env` convention (`server/CLAUDE.md`) |
| INV-5 | `server/package.json` is `skip-worktree` — a committed change usually means a local variant leaked back in | `changed server/package.json \| grep -q .` → match | WARNING | `TESTING.md` Conventions |
| INV-6 | E2E specs must stay deterministic — no AI `chat` command, only `--url`/`--text`/`find` locators | `changed e2e/specs \| grep -q .` and a step's `"cmd"` array in the spec JSON starts with `"chat"` — the real shape is `{"cmd": ["<verb>", ...], "label": "..."}` (see `e2e/specs/*.flow.json`), **not** a `"command"`/`"locator"` object key; `open`/`wait`/`find` are the only verbs in use today | WARNING | `TESTING.md` Conventions, `e2e/CLAUDE.md` |
| INV-7 | A DB-backed test that imports `test/helpers/pg.ts` must use the `.it.test.ts` suffix (otherwise it silently runs in the hermetic unit lane and either fails CI or worse, passes against nothing) | a `changed`-listed `server/**/*.test.ts` (not already `.it.test.ts`) whose diff/content adds an import of `test/helpers/pg.ts` (or `../.../helpers/pg.js`) | CRITICAL | `TESTING.md` Conventions |
| INV-8 | CI is path-filtered per package — a new cross-package alias needs the consuming workflow's `paths:` updated, or that workflow silently won't run | an **added** line anywhere in the diff matches `from ['"].*(reviewer-core\|vendor/shared)` (a genuinely new cross-package import — a relative import inside the package itself never matches this pattern, so self-contained refactors don't false-positive), **and** no added line in any `.github/workflows/*.yml` contains the literal `paths:` (not just "some workflow file changed") | WARNING | `TESTING.md` Conventions; see `.github/workflows/reviewer-core.yml` for the existing pattern |
| INV-9 | `routing.md` (and the skills catalog) must stay in sync with the skill set | a new `.claude/skills/<name>/SKILL.md` is `changed`-listed but neither `.claude/skills/pr-self-review/routing.md` nor `.claude/skills/README.md` is `changed`-listed in the same diff | WARNING | this skill's own maintenance contract, `routing.md` header |
| INV-10 | No top-level catch-all folders on the client | `changed client/src client/src/constants client/src/utils` includes a new (status `A`) `**/utils.ts`, `constants/**`, or `utils/**` path | WARNING | `react-architecture` skill, "no top-level constants/utils catch-all" rule |

## Remediation text shown per invariant (used verbatim in the report)

- INV-1: "Migration `<file>` was modified/deleted. Create a new migration instead of editing an applied one."
- INV-2: "`<file>` is vendored (do-not-touch). Make this change at the upstream source and re-vendor."
- INV-3: "`<schema file>` changed with no new migration in this diff. Run `cd server && pnpm db:generate` (then `db:migrate`)."
- INV-4: "Possible secret in `<file>:<line>`. Move it to `~/.devdigest/secrets.json` (see `server/CLAUDE.md`) and drop it from the diff."
- INV-5: "`server/package.json` is skip-worktree; this diff probably shouldn't include it — check for a local-only change leaking in."
- INV-6: "`<spec>` uses a non-deterministic locator or the `chat` command — e2e specs must stay deterministic (`TESTING.md`)."
- INV-7: "`<test file>` uses `test/helpers/pg.ts` but isn't named `*.it.test.ts` — rename it or it will run in the wrong lane."
- INV-8: "New dependency on `<package>` from `<workflow>`'s scope isn't reflected in that workflow's `paths:` — CI may silently skip it."
- INV-9: "New skill `<name>` added without updating `routing.md`/`.claude/skills/README.md`."
- INV-10: "`<file>` looks like a new catch-all folder — `react-architecture` forbids these; place the code at the narrowest scope that uses it."
