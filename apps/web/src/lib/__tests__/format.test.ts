/**
 * formatLength rounding contract.
 *
 * Hobbyists buy track in 1/8" or 1/16" increments. A solver display of
 * "5.0207 inches" makes Trackfit feel like CAD software for engineers,
 * which is the position the strategy doc tells us NOT to take.
 *
 * The contract:
 *  - inches: round to nearest 1/16" (0.0625"), trim trailing zeros.
 *  - mm: round to nearest whole mm.
 *
 * Underlying solver math is unchanged — these are display rounding only.
 */

import { describe, expect, it } from "vitest";
import { formatLength } from "../format";

describe("formatLength — hobbyist precision rounding", () => {
  it("rounds CAD-precision inches to a clean fraction-aligned string", () => {
    // 5.0207" came up in real testing — rounded to nearest 1/16 → 5.0
    // (5.0625 is the next 1/16 step up, and 5.0207 is closer to 5.0).
    expect(formatLength(127.526, "in")).toBe("5"); // 5.0207"
    expect(formatLength(127.0, "in")).toBe("5"); // 5.0"
  });

  it("preserves common standard fractional inch lengths", () => {
    expect(formatLength(228.6, "in")).toBe("9"); // 9" straight
    expect(formatLength(127, "in")).toBe("5"); // 5"
    expect(formatLength(114.3, "in")).toBe("4.5"); // 4.5" half
    expect(formatLength(44.45, "in")).toBe("1.75"); // 1 3/4"
    expect(formatLength(34.925, "in")).toBe("1.38"); // 1 3/8" (1.375 rounds to 1.375 = 22/16, displayed)
  });

  it("trims trailing zeros (not '5.00', not '4.50')", () => {
    expect(formatLength(127, "in")).toBe("5");
    expect(formatLength(114.3, "in")).toBe("4.5");
  });

  it("rounds mm to whole millimetres", () => {
    expect(formatLength(127.526, "mm")).toBe("128");
    expect(formatLength(228.6, "mm")).toBe("229");
    expect(formatLength(0.4, "mm")).toBe("0");
    expect(formatLength(0.5, "mm")).toBe("1");
  });

  it("does not return scientific notation or NaN for legal inputs", () => {
    for (const v of [0, 0.001, 1, 25.4, 100, 1000, 9999.99]) {
      const inStr = formatLength(v, "in");
      const mmStr = formatLength(v, "mm");
      expect(inStr).not.toContain("e");
      expect(mmStr).not.toContain("e");
      expect(inStr).not.toBe("NaN");
      expect(mmStr).not.toBe("NaN");
    }
  });

  it("never produces 4-decimal CAD-style noise", () => {
    // The original bug Stephen reported: 4-decimal output. The new
    // contract caps inch display at 2 decimals (the 1/16 alignment
    // puts every value at a 2-decimal-or-fewer string).
    for (const mm of [127.526, 228.605, 50.81, 9.527]) {
      const out = formatLength(mm, "in");
      const decimals = out.includes(".") ? out.split(".")[1]!.length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });
});
