/**
 * formatCost — the one rule that matters: a missing price is an em-dash, never
 * "$0.00". The rest is the ~2-significant-digit ladder the three cost surfaces
 * share, pinned to the values on the design.
 */
import { describe, it, expect } from "vitest";
import { formatCost } from "./format-cost";

describe("formatCost", () => {
  it("renders an em-dash for an unknown price, not zero", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatCost(undefined)).toBe("—");
  });

  it("distinguishes a genuinely free model from an unknown price", () => {
    expect(formatCost(0)).toBe("$0");
  });

  it("matches the design's values across three orders of magnitude", () => {
    expect(formatCost(0.0013)).toBe("$0.0013"); // timeline row
    expect(formatCost(0.014)).toBe("$0.014"); // PR list column
    expect(formatCost(0.06)).toBe("$0.06"); // drawer stat tile
    expect(formatCost(1.25)).toBe("$1.25");
  });

  it("keeps sub-cent runs legible instead of rounding them away", () => {
    expect(formatCost(0.0004)).toBe("$0.0004");
    expect(formatCost(0.00002)).toBe("<$0.0001");
  });

  it("trims trailing zeros down to two decimals", () => {
    expect(formatCost(0.1)).toBe("$0.10");
    expect(formatCost(12)).toBe("$12.00");
  });
});
