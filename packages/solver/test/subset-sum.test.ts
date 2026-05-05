import { describe, expect, it } from "vitest";
import { findCombinations, IN_TO_MM } from "../src/index.js";
import type { InventoryItem } from "../src/index.js";

/**
 * Golden tests for the v0.2 1D subset-sum solver.
 *
 * Any change to subset-sum.ts MUST keep these passing — the friend will
 * notice immediately if a near-miss suggestion silently regresses.
 */

const inches = (n: number) => n * IN_TO_MM;

const fastTrackInventory: InventoryItem[] = [
  { label: '1 3/8" fitter', length_mm: inches(1.375), qty: 4 },
  { label: '1 3/4" straight', length_mm: inches(1.75), qty: 4 },
  { label: '4 1/2" straight', length_mm: inches(4.5), qty: 4 },
  { label: '5" straight', length_mm: inches(5), qty: 4 },
  { label: '10" straight', length_mm: inches(10), qty: 4 },
];

describe("findCombinations — exact-fit cases", () => {
  it("finds an exact 10\" solution from a single piece", () => {
    const r = findCombinations(fastTrackInventory, inches(10), 0);
    expect(r.solutions.length).toBeGreaterThan(0);
    const top = r.solutions[0]!;
    expect(top.deviation_mm).toBe(0);
    expect(top.pieceCount).toBe(1);
    expect(top.pieces[0]!.label).toBe('10" straight');
  });

  it("finds the 1-piece exact fit before any 2-piece exact fit (lower piece count wins on tie)", () => {
    const r = findCombinations(fastTrackInventory, inches(10), 0);
    const top = r.solutions[0]!;
    expect(top.pieceCount).toBe(1);
    // 5+5 also sums to 10, but should rank lower by piece count
    const twoFiveStraight = r.solutions.find(
      (s) =>
        s.pieces.length === 1 &&
        s.pieces[0]!.label === '5" straight' &&
        s.pieces[0]!.count === 2,
    );
    expect(twoFiveStraight).toBeDefined();
    if (twoFiveStraight) {
      expect(r.solutions.indexOf(twoFiveStraight)).toBeGreaterThan(0);
    }
  });
});

describe("findCombinations — tolerance handling", () => {
  it("includes a combo within tolerance even if not exact", () => {
    // target 10.1" with 0.2" tolerance — the 10" straight should match
    const r = findCombinations(fastTrackInventory, inches(10.1), inches(0.2));
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions[0]!.deviation_mm).toBeLessThanOrEqual(inches(0.2) + 1e-6);
  });

  it("excludes a combo outside tolerance", () => {
    // target 10.5" with 0.1" tolerance — pure 10" straight is short by 0.5"
    const r = findCombinations(fastTrackInventory, inches(10.5), inches(0.1));
    const has10Only = r.solutions.some(
      (s) =>
        s.pieces.length === 1 &&
        s.pieces[0]!.label === '10" straight' &&
        s.pieces[0]!.count === 1,
    );
    expect(has10Only).toBe(false);
  });
});

describe("findCombinations — near-miss tracking", () => {
  it("returns bestUnder for an unreachable target with no exact fit", () => {
    // target 13.5" with 0 tolerance.
    // 10 + 1.75 = 11.75 (under by 1.75)
    // 10 + 1.75 + 1.75 = 13.5 EXACT — so this should be a solution, not under
    // Use 13.6" to force a near-miss-under
    const r = findCombinations(fastTrackInventory, inches(13.6), 0);
    expect(r.solutions.length).toBe(0);
    expect(r.bestUnder).not.toBeNull();
    expect(r.bestUnder!.total_mm).toBeLessThan(inches(13.6));
    // The best-under should suggest a missing-piece length: 13.6 - bestUnder.total
    const missing_mm = inches(13.6) - r.bestUnder!.total_mm;
    expect(missing_mm).toBeGreaterThan(0);
  });

  it("returns bestOver when no combination fits without overshooting", () => {
    // target 9", inventory has 10" min straight + smaller pieces
    // 4.5 + 4.5 = 9 exact actually
    // Use a target that forces only-overshoot: 9.1" with 0 tol
    // 4.5 + 4.5 = 9 (under by 0.1)
    // 5 + 4.5 = 9.5 (over by 0.4)
    // So we get bestUnder=9 and bestOver=9.5
    const r = findCombinations(fastTrackInventory, inches(9.1), 0);
    expect(r.solutions.length).toBe(0);
    expect(r.bestUnder).not.toBeNull();
    expect(r.bestOver).not.toBeNull();
    expect(r.bestOver!.total_mm).toBeGreaterThan(inches(9.1));
  });
});

describe("findCombinations — no-solution edge cases", () => {
  it("returns empty solutions and null near-misses for empty inventory", () => {
    const r = findCombinations([], inches(10), 0);
    expect(r.solutions).toHaveLength(0);
    expect(r.bestUnder).toBeNull();
    expect(r.bestOver).toBeNull();
  });

  it("ignores items with zero quantity", () => {
    const inv: InventoryItem[] = [
      { label: '10" straight', length_mm: inches(10), qty: 0 },
    ];
    const r = findCombinations(inv, inches(10), 0);
    expect(r.solutions).toHaveLength(0);
    expect(r.bestUnder).toBeNull();
  });

  it("ignores items with zero or negative length", () => {
    const inv: InventoryItem[] = [
      { label: "phantom", length_mm: 0, qty: 4 },
      { label: '10" straight', length_mm: inches(10), qty: 1 },
    ];
    const r = findCombinations(inv, inches(10), 0);
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions[0]!.pieces[0]!.label).toBe('10" straight');
  });
});

describe("findCombinations — fitter-piece coverage", () => {
  it("uses the 1.375\" fitter to close gaps that other pieces can't", () => {
    // 10 + 1.375 = 11.375 — only achievable with the fitter
    const r = findCombinations(fastTrackInventory, inches(11.375), 0);
    expect(r.solutions.length).toBeGreaterThan(0);
    const usesFitter = r.solutions[0]!.pieces.some(
      (p) => p.label === '1 3/8" fitter',
    );
    expect(usesFitter).toBe(true);
  });

  it("finds a 4-piece fitter combination for a long awkward gap", () => {
    // 4 × 1.375 = 5.5 — exact-fit only with 4 fitters
    const inv: InventoryItem[] = [
      { label: '1 3/8" fitter', length_mm: inches(1.375), qty: 8 },
      { label: '10" straight', length_mm: inches(10), qty: 1 },
    ];
    const r = findCombinations(inv, inches(5.5), 0);
    expect(r.solutions.length).toBeGreaterThan(0);
    const top = r.solutions[0]!;
    expect(top.deviation_mm).toBe(0);
    expect(top.pieces[0]!.count).toBe(4);
    expect(top.pieces[0]!.label).toBe('1 3/8" fitter');
  });
});

describe("findCombinations — performance sanity", () => {
  it("solves a 12-type inventory in well under 200ms", () => {
    const inv: InventoryItem[] = [];
    for (let i = 1; i <= 12; i++) {
      inv.push({ label: `piece-${i}`, length_mm: i * 10, qty: 30 });
    }
    const t0 = performance.now();
    const r = findCombinations(inv, 250, 0.5);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(200);
    expect(r.solutions.length).toBeGreaterThan(0);
  });
});
