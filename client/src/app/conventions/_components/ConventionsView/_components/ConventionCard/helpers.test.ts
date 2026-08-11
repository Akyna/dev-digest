import { describe, it, expect } from "vitest";
import { confidenceColor } from "./helpers";

describe("confidenceColor", () => {
  it("is red below 50%", () => {
    expect(confidenceColor(0)).toBe("var(--crit)");
    expect(confidenceColor(49)).toBe("var(--crit)");
  });

  it("is orange from 50% up to (not including) 80%", () => {
    expect(confidenceColor(50)).toBe("var(--warn)");
    expect(confidenceColor(79)).toBe("var(--warn)");
  });

  it("is green at 80% and above", () => {
    expect(confidenceColor(80)).toBe("var(--ok)");
    expect(confidenceColor(100)).toBe("var(--ok)");
  });
});
