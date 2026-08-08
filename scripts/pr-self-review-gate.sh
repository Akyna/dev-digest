#!/usr/bin/env bash
#
# Deterministic gate for pr-self-review. No model call — reads the stamp written by
# `/pr-self-review` (.devdigest/pr-self-review.json) and checks it's fresh and clean.
#
#   scripts/pr-self-review-gate.sh          # exit 0 = ok to push, 1 = blocked (reason on stderr)
#
# Wired into .githooks/pre-push and .claude/settings.json's PreToolUse hook. See
# .claude/skills/pr-self-review/SKILL.md and docs/pr-self-review-plan.md for the full design.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAMP=".devdigest/pr-self-review.json"

fail() {
  echo "pr-self-review gate: $1" >&2
  exit 1
}

command -v jq >/dev/null || fail "jq not found — required to read the stamp file"

[ -f "$STAMP" ] || fail "no review on record — run /pr-self-review before pushing"

BASE="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo "")"
[ -n "$BASE" ] || fail "could not determine base ref (no local/origin main) — run /pr-self-review manually"

# Same hash recipe the skill uses when writing the stamp (canonical copy also in
# .claude/skills/pr-self-review/SKILL.md phase 6 and report-format.md — keep all three in
# sync). Hashes actual DIFF CONTENT for tracked changes plus full CONTENT of untracked
# files — not just file names/status. A name-status-only hash would let a stamp stay
# "valid" after further edits to an already-touched file (same file set, different,
# unreviewed content) — a silent gate bypass. This doesn't have that gap: any content
# change changes the hash.
current_hash() {
  {
    git diff "$BASE" --
    git ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do
      printf '%s\n' "$f"
      cat "$f"
    done
  } | shasum -a 256 | awk '{print $1}'
}

FILES_HASH="$(current_hash)"

STAMP_HASH="$(jq -r '.files_hash // ""' "$STAMP")"
VERDICT="$(jq -r '.verdict // ""' "$STAMP")"
OVERRIDE="$(jq -r '.override // ""' "$STAMP")"
CRITICAL="$(jq -r '.counts.CRITICAL // 0' "$STAMP")"

[ "$FILES_HASH" = "$STAMP_HASH" ] || fail "review is stale (changes since last run) — re-run /pr-self-review"

if [ "$VERDICT" = "REQUEST_CHANGES" ] && [ -z "$OVERRIDE" ]; then
  fail "$CRITICAL critical finding(s) unresolved — fix them, re-run /pr-self-review, or record an override"
fi

exit 0
