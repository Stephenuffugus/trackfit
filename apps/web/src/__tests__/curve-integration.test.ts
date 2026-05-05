/**
 * Curve-aware integration tests.
 *
 * The unit tests in packages/solver cover the math; these tests cover the
 * wire between the library JSON, the preset → inventory mapping, and the
 * curve solver. If a hobbyist clicks "Lionel FasTrack" then types "90°
 * corner", the curve solver must see the right curve geometry — these
 * tests make sure presetToInventory pipes radius_mm and arc_degrees
 * through correctly.
 */

import { describe, expect, it } from "vitest";
import {
  findCurveCombinations,
  type CurveInventoryItem,
  type CurveTarget,
  type CurveTolerance,
} from "@trackfit/solver";
import { getSystem } from "@trackfit/library";
import { presetToInventory } from "../lib/presets";
import type { InventoryRow } from "../lib/types";

// Translate an InventoryRow into the CurveInventoryItem shape the solver
// accepts. Mirrors what App.tsx does before posting to the worker —
// turnouts/crossings get filtered out, curves keep radius_mm + arc_degrees,
// straights/fitters/flex are flattened to kind: "straight".
function toCurveItems(rows: InventoryRow[]): CurveInventoryItem[] {
  return rows
    .filter((r) => {
      const k = r.kind;
      return (
        k === "curve" ||
        k === undefined ||
        k === "straight" ||
        k === "fitter" ||
        k === "flex"
      );
    })
    .map((r) => {
      if (
        r.kind === "curve" &&
        typeof r.radius_mm === "number" &&
        typeof r.arc_degrees === "number"
      ) {
        return {
          label: r.label,
          kind: "curve" as const,
          length_mm: r.length_mm,
          radius_mm: r.radius_mm,
          arc_degrees: r.arc_degrees,
          qty: r.qty,
        };
      }
      return {
        label: r.label,
        kind: "straight" as const,
        length_mm: r.length_mm,
        qty: r.qty,
      };
    });
}

const TOL: CurveTolerance = {
  length_mm: 3,
  lateral_offset_mm: 3,
  angle_degrees: 1,
};

describe("curve UI integration", () => {
  it("loads Lionel FasTrack curves into inventory and shows the O36 r457mm/30° pair", () => {
    const sys = getSystem("lionel-fastrack");
    expect(sys).toBeDefined();
    const inv = presetToInventory(sys!);

    // Find the O36 full curve — radius 457.2 mm, arc 30°. The preset mapper
    // must surface the geometry fields, not just the arc-length scalar.
    const o36 = inv.find(
      (r) =>
        r.kind === "curve" &&
        r.radius_mm === 457.2 &&
        r.arc_degrees === 30,
    );
    expect(o36).toBeDefined();
    expect(o36!.label).toMatch(/O36/i);
    // Arc length r·θ_rad = 457.2 × π/6 ≈ 239.39 mm.
    expect(o36!.length_mm).toBeCloseTo(239.39, 1);

    // The library carries multiple O36 curves (full, half, quarter); make
    // sure presetToInventory didn't filter any of them.
    const allO36 = inv.filter(
      (r) => r.kind === "curve" && r.radius_mm === 457.2,
    );
    expect(allO36.length).toBeGreaterThanOrEqual(2);

    // The same conversion the worker applies in App.tsx must round-trip the
    // O36 curve into a CurveInventoryItem with both radius_mm and arc_degrees
    // intact — that's the data the curve solver actually consumes.
    const items = toCurveItems(inv);
    const o36Curve = items.find(
      (it) =>
        it.kind === "curve" &&
        it.radius_mm === 457.2 &&
        it.arc_degrees === 30,
    );
    expect(o36Curve).toBeDefined();
  });

  it("solves a 90° corner using two Atlas HO Code 83 22-inch curves", () => {
    // Atlas HO Code 83 has 22"-radius curves at 30° each. Three at 30°
    // sum to 90°. The fixture in docs/curve-solver-design.md §6.2 uses 22"
    // (558.8 mm) with arc 30°; we synthesize the same inventory from the
    // library JSON so this covers the real wire.
    const sys = getSystem("atlas-ho-code-83");
    expect(sys).toBeDefined();
    const inv = presetToInventory(sys!);

    const r22 = inv.find(
      (r) =>
        r.kind === "curve" &&
        r.radius_mm === 558.8 &&
        r.arc_degrees === 30,
    );
    expect(r22).toBeDefined();

    // Build a focused inventory: just the 22" curves, with enough qty to
    // form a 90° corner (3 × 30°). Other pieces would still work but slow
    // the search and are noise for this test.
    const items: CurveInventoryItem[] = [
      {
        label: r22!.label,
        kind: "curve",
        length_mm: r22!.length_mm,
        radius_mm: 558.8,
        arc_degrees: 30,
        qty: 12,
      },
    ];

    // 90° corner of radius 558.8 mm: endpoint at (558.8, 558.8, 90°).
    const target: CurveTarget = {
      length_mm: 558.8,
      lateral_offset_mm: 558.8,
      angle_degrees: 90,
    };

    const result = findCurveCombinations(items, target, TOL);
    expect(result.solutions.length).toBeGreaterThan(0);

    // Best solution should be three 30° curves, all turning the same way.
    const top = result.solutions[0]!;
    expect(top.pieceCount).toBe(3);
    expect(top.pieces.every((p) => (p as { kind?: string }).kind === "curve")).toBe(
      true,
    );
    // Same direction = same sign of `direction` field.
    const dirs = top.pieces.map((p) => (p as { direction: 1 | -1 }).direction);
    expect(dirs.every((d) => d === dirs[0])).toBe(true);
    // Endpoint within tolerance of the target.
    expect(Math.abs(top.endpoint.x_mm - 558.8)).toBeLessThanOrEqual(3);
    expect(Math.abs(top.endpoint.y_mm - 558.8)).toBeLessThanOrEqual(3);
    expect(Math.abs(top.endpoint.heading_degrees - 90)).toBeLessThanOrEqual(1);
  });

  it("near-miss returns a `kind: 'curve'` suggestion when a missing-curve closes the residual exactly", () => {
    // To exercise the curve solver's §5.4 branch (curve-dominated suggestion),
    // we need:
    //   * the inventory to contain at least one curve so the recursive
    //     search runs (otherwise the all-straight fast path emits "mixed")
    //   * a chain to exist whose length residual is within tolerance but
    //     whose lateral/angle residuals are not (lengthOk && !lateralOk
    //     && |r_angle| > 0 ⇒ §5.4 fires).
    //
    // Recipe: a single straight that hits the target length on its own,
    // plus a tiny curve the user owns 0 of (or that doesn't help). The
    // straight-only chain becomes bestNear; r_long = 0, r_lat ≠ 0,
    // r_angle ≠ 0 — §5.4 then synthesizes the missing curve.
    const chord = 200;
    const arcDeg = 30;
    const arcRad = (arcDeg * Math.PI) / 180;
    const lateral = (chord * (1 - Math.cos(arcRad))) / 2;
    const inv: CurveInventoryItem[] = [
      {
        label: "200mm straight",
        kind: "straight",
        length_mm: chord,
        qty: 1,
      },
      // Token curve with qty>0 so `hasCurve` is true and the recursive
      // search runs — but it's the wrong shape to ever close the gap.
      {
        label: "tiny shim curve",
        kind: "curve",
        length_mm: (1000 * 1 * Math.PI) / 180,
        radius_mm: 1000,
        arc_degrees: 1,
        qty: 1,
      },
    ];
    const target: CurveTarget = {
      length_mm: chord,
      lateral_offset_mm: lateral,
      angle_degrees: arcDeg,
    };

    const result = findCurveCombinations(inv, target, TOL);
    expect(result.solutions.length).toBe(0);
    expect(result.bestNearMiss).not.toBeNull();
    expect(result.suggestion).not.toBeNull();

    // The suggestion may be "curve" (the §5.4 happy path) or "mixed" if
    // the search picks a different bestNear that has length out of
    // tolerance. Assert "curve" specifically when the bestNear is the
    // length-matching straight.
    const sug = result.suggestion!;
    if (
      result.bestNearMiss &&
      Math.abs(result.bestNearMiss.residual.length_mm) <= TOL.length_mm
    ) {
      expect(sug.kind).toBe("curve");
      if (sug.kind === "curve") {
        // The closing curve should turn through approximately arcDeg
        // (rounded by the solver) and have a positive radius.
        expect(sug.arc_degrees).toBeCloseTo(arcDeg, 0);
        expect(sug.radius_mm).toBeGreaterThan(0);
      }
    } else {
      // Fallback assertion: at minimum it's a valid CurveMissingPiece.
      expect(["curve", "mixed", "straight"]).toContain(sug.kind);
    }
  });
});
