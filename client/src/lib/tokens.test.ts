/**
 * approxTokens — the contract is "cheap estimate, never throws". The nullish
 * guard matters most: prompt-assembly slots can be absent, and `undefined.length`
 * would take the whole run-trace drawer down with it.
 */
import { describe, it, expect } from "vitest";
import { approxTokens } from "./tokens";

describe("approxTokens", () => {
  it("treats missing or empty text as zero tokens", () => {
    expect(approxTokens(null)).toBe(0);
    expect(approxTokens(undefined)).toBe(0);
    expect(approxTokens("")).toBe(0);
  });

  it("estimates one token per four characters", () => {
    expect(approxTokens("abcd")).toBe(1);
    expect(approxTokens("a".repeat(400))).toBe(100);
  });

  it("rounds a partial token up, so any content counts as at least one", () => {
    expect(approxTokens("a")).toBe(1);
    expect(approxTokens("abcde")).toBe(2);
  });

  it("matches the server heuristic it mirrors (ceil(chars / 4))", () => {
    const text = "You are a code reviewer. Ground every finding in the diff.";
    expect(approxTokens(text)).toBe(Math.ceil(text.length / 4));
  });
});
