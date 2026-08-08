#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash). Intercepts `git push` / `gh pr create` before they run
# and blocks them if scripts/pr-self-review-gate.sh fails. No-op for every other Bash call.
#
# This is defense-in-depth, not the real boundary: it's a lexical match on the Bash command
# text, so it can both under-fire (an alias, a wrapper script, irregular whitespace) and
# over-fire (a command that merely mentions "git push" in a string). The actual enforcement
# is .githooks/pre-push, which git invokes for every push regardless of how it was typed and
# has none of this class of gap.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cmd="$(jq -r '.tool_input.command // empty')"
norm="$(printf '%s' "$cmd" | tr -s '[:space:]' ' ')"

case "$norm" in
  *"git push"*|*"gh pr create"*)
    if reason="$("$ROOT/scripts/pr-self-review-gate.sh" 2>&1 1>/dev/null)"; then
      exit 0
    fi
    jq -n --arg reason "$reason" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $reason
      }
    }'
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
