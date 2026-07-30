#!/usr/bin/env python3
"""Term-overlap duplicate check for a candidate INSIGHTS.md entry.

Adapted from the dedup logic in glebis/claude-skills' retro_engine.py: a
candidate is a likely duplicate if enough of its meaningful (non-stopword)
terms already appear somewhere in the target file.

Usage:
    python3 check_duplicate.py <path-to-INSIGHTS.md> "<candidate entry text>"

Prints exactly one line: LIKELY_DUPLICATE or NEW. Exit code 0 either way —
this is advisory, not a hard gate.
"""

import re
import sys

STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "to", "in", "for", "of",
    "and", "or", "not", "don't", "do", "use", "using", "used", "this",
    "that", "with", "on", "at", "it", "be", "as", "by", "from", "we", "you",
    "when", "if", "so", "но", "не", "це", "у", "в", "на", "з", "та", "і",
}

THRESHOLD = 0.5


def normalize(text: str) -> str:
    return re.sub(r"[^\w'\s]", " ", text.lower())


def meaningful_terms(text: str) -> set[str]:
    return {w for w in normalize(text).split() if w and w not in STOPWORDS}


def is_duplicate(candidate: str, haystack: str, threshold: float = THRESHOLD) -> bool:
    terms = meaningful_terms(candidate)
    if not terms:
        return False
    haystack_norm = normalize(haystack)
    matches = sum(1 for term in terms if term in haystack_norm)
    return (matches / len(terms)) >= threshold


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: check_duplicate.py <path-to-INSIGHTS.md> \"<candidate text>\"", file=sys.stderr)
        return 2

    path, candidate = sys.argv[1], sys.argv[2]
    try:
        with open(path, encoding="utf-8") as f:
            existing = f.read()
    except FileNotFoundError:
        print("NEW")
        return 0

    print("LIKELY_DUPLICATE" if is_duplicate(candidate, existing) else "NEW")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
