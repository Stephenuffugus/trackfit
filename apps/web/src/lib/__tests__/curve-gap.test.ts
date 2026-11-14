import { describe, expect, it } from "vitest";
import { findCurveCombinations } from "@trackfit/solver";
import { chordToCurveTarget } from "../curve-gap";

const R = 457.2; // 18" radius
const chordOf = (r: number, deg: number) => 2 * r * Math.sin(((deg * Math.PI) / 180) / 2);

describe("chordToCurveTarget", () => {
  it("one 30° curve's own chord gives its own end point", () => {
    const t = chordToCurveTarget(chordOf(R, 30), 30);
    expect(t.length_mm).toBeCloseTo(R * Math.sin(Math.PI / 6), 6);
    expect(t.lateral_offset_mm).toBeCloseTo(R * (1 - Math.cos(Math.PI / 6)), 6);
  });

  it("a 30° gap measured off one 18\" curve is an exact fit for that curve", () => {
    const inv = [
      { label: '18" curve 30°', kind: "curve" as const, length_mm: (R * Math.PI) / 6, radius_mm: R, arc_degrees: 30, qty: 12 },
      { label: '9" straight', kind: "straight" as const, length_mm: 228.6, qty: 4 },
    ];
    const res = findCurveCombinations(inv, chordToCurveTarget(chordOf(R, 30), 30), {
      length_mm: 2, lateral_offset_mm: 2, angle_degrees: 1,
    });
    expect(res.solutions.length).toBeGreaterThan(0);
    const top = res.solutions[0]!;
    const pieces = top.pieces.reduce((n, p) => n + p.count, 0);
    expect(pieces).toBe(1);
  });

  it("a 60° gap is two of the 30° curves", () => {
    const inv = [
      { label: '18" curve 30°', kind: "curve" as const, length_mm: (R * Math.PI) / 6, radius_mm: R, arc_degrees: 30, qty: 12 },
    ];
    const res = findCurveCombinations(inv, chordToCurveTarget(chordOf(R, 60), 60), {
      length_mm: 2, lateral_offset_mm: 2, angle_degrees: 1,
    });
    expect(res.solutions.length).toBeGreaterThan(0);
    expect(res.solutions[0]!.pieces.reduce((n, p) => n + p.count, 0)).toBe(2);
  });
});
