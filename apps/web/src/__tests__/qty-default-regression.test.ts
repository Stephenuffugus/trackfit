/**
 * Regression guard for the qty-default failure Stephen hit on his
 * phone the first time he tried the v0.3.4 build:
 *
 *   1. Load a preset (e.g. Lionel FasTrack)
 *   2. Type a target gap
 *   3. Hit Solve
 *   4. … nothing.
 *
 * Root cause: in v0.3.3 we lowered DEFAULT_PRESET_QTY from 4 to 0 to
 * address a focus-group finding (no real user owns 4 of every catalog
 * SKU). That was right for users editing a real inventory but silently
 * broke the load-and-solve demo path: the solver correctly found
 * nothing because the user owned nothing.
 *
 * v0.3.5 fixed it by setting DEFAULT_PRESET_QTY = 1. This test pins
 * that the load-and-solve happy path returns SOMETHING — a solution OR
 * a near-miss with a typed missing-piece suggestion. If a future
 * "improvement" sets the default back to 0 (or to anything that breaks
 * the path), this test fails immediately.
 */

import { describe, expect, it } from "vitest";
import { findCombinations, IN_TO_MM } from "@trackfit/solver";
import { getSystem } from "@trackfit/library";
import { presetToInventory } from "../lib/presets";
import { DEFAULT_PRESET_QTY } from "../lib/constants";

describe("qty-default load-and-solve regression guard", () => {
  it("DEFAULT_PRESET_QTY is non-zero", () => {
    // The exact value can change with research; what must NEVER hold
    // is qty: 0 — the user loads a preset, sees rows that look usable,
    // hits Solve, and the solver has nothing to work with. The current
    // value (1) splits the difference between "I have 1 of each" and
    // the v0.2 default of 4.
    expect(DEFAULT_PRESET_QTY).toBeGreaterThan(0);
  });

  it("loading FasTrack stamps every row with the non-zero default qty", () => {
    const sys = getSystem("lionel-fastrack");
    expect(sys).toBeDefined();
    const rows = presetToInventory(sys!);
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      expect(row.qty).toBe(DEFAULT_PRESET_QTY);
    }
  });

  it("a 15-inch gap on a load-and-solve FasTrack inventory yields a result", () => {
    // The exact happy-path Stephen tried: load preset, type 15 inches,
    // hit Solve. Should find 10 + 5 = 15 exactly.
    const sys = getSystem("lionel-fastrack");
    const rows = presetToInventory(sys!);
    const items = rows
      .filter(
        (r) => r.kind === "straight" || r.kind === "fitter" || r.kind === "flex",
      )
      .filter((r) => r.length_mm > 0)
      .map((r) => ({ label: r.label, length_mm: r.length_mm, qty: r.qty }));

    const target_mm = 15 * IN_TO_MM; // 381 mm
    const result = findCombinations(items, target_mm, 0);

    // Either an exact fit or a near-miss must surface — we must NOT
    // return all-empty, which is the symptom Stephen hit.
    const surfacedSomething =
      result.solutions.length > 0 ||
      result.bestUnder !== null ||
      result.bestOver !== null;
    expect(surfacedSomething).toBe(true);
  });

  it("a 13.6-inch gap on a load-and-solve FasTrack inventory surfaces a near-miss with a precise missing-piece length", () => {
    // No exact fit at FasTrack lengths {10, 5, 4.5, 1.75, 1.375} → must
    // emit a typed near-miss the SUGGESTED callout can render.
    const sys = getSystem("lionel-fastrack");
    const rows = presetToInventory(sys!);
    const items = rows
      .filter(
        (r) => r.kind === "straight" || r.kind === "fitter" || r.kind === "flex",
      )
      .filter((r) => r.length_mm > 0)
      .map((r) => ({ label: r.label, length_mm: r.length_mm, qty: r.qty }));

    const target_mm = 13.6 * IN_TO_MM;
    const result = findCombinations(items, target_mm, 0);

    expect(result.bestUnder).not.toBeNull();
    const missing_mm = target_mm - result.bestUnder!.total_mm;
    // Sanity: the missing piece is positive, bounded, and meaningfully
    // small. This is the v0.2 killer-feature contract.
    expect(missing_mm).toBeGreaterThan(0);
    expect(missing_mm).toBeLessThan(254); // smaller than a single 10" straight
  });

  it("loading any of the 16 systems produces a non-empty inventory at default qty", () => {
    // Defence in depth: a preset that returned zero rows would also
    // silently break load-and-solve, and an audit gap on any one
    // system shouldn't pass review. (Turnouts/crossings have nullable
    // length_mm so they may filter out; we assert at least one
    // length-bearing row per system.)
    for (const id of [
      "lionel-fastrack",
      "atlas-ho-code-83",
      "atlas-ho-code-100",
      "atlas-n-code-80",
      "kato-unitrack-ho",
      "kato-unitrack-n",
      "bachmann-ez-track-ho",
      "bachmann-ez-track-n",
      "marklin-c-track",
      "marklin-k-track",
      "peco-streamline-code-83",
      "peco-streamline-code-100",
      "peco-setrack-code-100",
      "hornby-oo",
      "lionel-o27-tubular",
      "atlas-o-true-track",
    ]) {
      const sys = getSystem(id);
      expect(sys, `system ${id} should be loadable`).toBeDefined();
      const rows = presetToInventory(sys!);
      const lengthBearing = rows.filter(
        (r) => typeof r.length_mm === "number" && r.length_mm > 0,
      );
      expect(
        lengthBearing.length,
        `system ${id} should have at least one length-bearing row`,
      ).toBeGreaterThan(0);
    }
  });
});
