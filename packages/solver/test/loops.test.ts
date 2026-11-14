import { describe, expect, it } from "vitest";
import { findLoops, tracePlan, findCombinations, IN_TO_MM } from "../src/index.js";
import type { LoopPiece, LoopPlan } from "../src/index.js";

const inch = (n: number) => n * IN_TO_MM;

// Bachmann E-Z HO style: 18" radius curves, 30 degrees (12 per circle).
const ezCurve = (qty: number): LoopPiece => ({
  label: '18" radius curve', kind: "curve", length_mm: 0, radius_mm: inch(18), arc_degrees: 30, qty, system_id: "ez",
});
const ezStraight = (len: number, qty: number): LoopPiece => ({
  label: `${len}" straight`, kind: "straight", length_mm: inch(len), qty, system_id: "ez",
});

function closes(plan: LoopPlan) {
  const { end } = tracePlan(plan);
  expect(Math.abs(end.x)).toBeLessThan(1.01); // within the 1 mm side tolerance
  expect(Math.abs(end.y)).toBeLessThan(0.01);
  expect(Math.abs(end.heading - 2 * Math.PI)).toBeLessThan(1e-9);
}

function withinInventory(plan: LoopPlan, inv: LoopPiece[]) {
  for (const part of plan.parts) {
    const owned = inv
      .filter((p) => p.label === part.label && p.kind === part.kind)
      .reduce((s, p) => s + p.qty, 0);
    expect(part.count).toBeLessThanOrEqual(owned);
  }
}

describe("findLoops", () => {
  it("a starter set (12 curves, 4 straights) makes a circle and an oval that close", () => {
    const inv = [ezCurve(12), ezStraight(9, 4)];
    const r = findLoops(inv);
    expect(r.plans.length).toBeGreaterThan(0);
    const biggest = r.plans[0]!;
    expect(biggest.shape).toBe("oval");
    expect(biggest.side_mm).toBeCloseTo(inch(18), 5); // 2 x 9" per side
    expect(biggest.total_pieces).toBe(16);
    expect(r.plans.some((p) => p.shape === "circle")).toBe(true);
    for (const p of r.plans) {
      closes(p);
      withinInventory(p, inv);
    }
  });

  it("an odd straight is left out so both sides match", () => {
    const inv = [ezCurve(12), ezStraight(9, 3)];
    const r = findLoops(inv);
    expect(r.plans[0]!.side_mm).toBeCloseTo(inch(9), 5);
  });

  it("mixes lengths to make equal sides (9+6+3 against 9+9)", () => {
    const inv = [ezCurve(12), ezStraight(9, 3), ezStraight(6, 1), ezStraight(3, 1)];
    const r = findLoops(inv);
    expect(r.plans[0]!.side_mm).toBeCloseTo(inch(18), 5);
    for (const p of r.plans) {
      closes(p);
      withinInventory(p, inv);
    }
  });

  it("11 curves of 30 degrees cannot close, and says how short", () => {
    const r = findLoops([ezCurve(11), ezStraight(9, 4)]);
    expect(r.plans).toEqual([]);
    expect(r.nearest).toMatch(/30 degrees short/);
  });

  it("no curves at all is explained", () => {
    const r = findLoops([ezStraight(9, 10)]);
    expect(r.plans).toEqual([]);
    expect(r.reason).toMatch(/curved pieces/);
  });

  it("never joins pieces from two systems", () => {
    const other: LoopPiece = { ...ezCurve(6), system_id: "kato" };
    const r = findLoops([ezCurve(6), other, ezStraight(9, 4)]);
    expect(r.plans).toEqual([]);
  });

  it("does not mix two curve radii in one loop", () => {
    const wide: LoopPiece = { ...ezCurve(0), label: '22" radius curve', radius_mm: inch(22), arc_degrees: 22.5, qty: 8 };
    const r = findLoops([ezCurve(6), wide]);
    expect(r.plans).toEqual([]); // 180 + 180 at different radii does not close
  });

  it("respects the table size", () => {
    const inv = [ezCurve(12), ezStraight(9, 8)];
    const all = findLoops(inv);
    expect(all.plans[0]!.side_mm).toBeCloseTo(inch(36), 5);
    const small = findLoops(inv, { maxWidthMm: inch(60), maxDepthMm: inch(40) });
    for (const p of small.plans) expect(p.width_mm).toBeLessThanOrEqual(inch(60) + 1e-6);
    expect(small.plans[0]!.side_mm).toBeCloseTo(inch(18), 5);
    const tooSmall = findLoops(inv, { maxWidthMm: inch(30), maxDepthMm: inch(30) });
    expect(tooSmall.plans).toEqual([]);
    expect(tooSmall.reason).toMatch(/bigger than the space/);
  });

  it("mixed sweeps at one radius (45 + 15) still make two half circles", () => {
    const a: LoopPiece = { label: "R282-45", kind: "curve", length_mm: 0, radius_mm: 282, arc_degrees: 45, qty: 6, system_id: "k" };
    const b: LoopPiece = { label: "R282-15", kind: "curve", length_mm: 0, radius_mm: 282, arc_degrees: 15, qty: 6, system_id: "k" };
    const r = findLoops([a, b]);
    expect(r.plans.length).toBe(1);
    closes(r.plans[0]!);
    withinInventory(r.plans[0]!, [a, b]);
  });

  it("random inventories: every plan closes and stays within the box", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let t = 0; t < 40; t++) {
      const inv: LoopPiece[] = [
        ezCurve(Math.floor(rnd() * 20)),
        ezStraight(9, Math.floor(rnd() * 8)),
        ezStraight(6, Math.floor(rnd() * 4)),
        ezStraight(3, Math.floor(rnd() * 4)),
        ezStraight(1.5, Math.floor(rnd() * 3)),
      ];
      const r = findLoops(inv);
      for (const p of r.plans) {
        closes(p);
        withinInventory(p, inv);
      }
      if (inv[0]!.qty >= 12) expect(r.plans.length).toBeGreaterThan(0);
    }
  });
});

describe("findCombinations never uses more than you own", () => {
  it("random straight inventories", () => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let t = 0; t < 30; t++) {
      const inv = [
        { label: "a", length_mm: inch(9), qty: Math.floor(rnd() * 4) },
        { label: "b", length_mm: inch(6), qty: Math.floor(rnd() * 4) },
        { label: "c", length_mm: inch(3), qty: Math.floor(rnd() * 4) },
        { label: "d", length_mm: inch(1.5), qty: Math.floor(rnd() * 4) },
      ];
      const target = inch(Math.round(rnd() * 40));
      const res = findCombinations(inv, target, 1);
      const all = [...res.solutions, res.bestUnder, res.bestOver].filter(Boolean) as typeof res.solutions;
      for (const s of all) {
        const sum = s.pieces.reduce((acc, p) => acc + p.length_mm * p.count, 0);
        expect(sum).toBeCloseTo(s.total_mm, 6);
        for (const p of s.pieces) {
          const owned = inv.find((i) => i.label === p.label)!.qty;
          expect(p.count).toBeLessThanOrEqual(owned);
        }
      }
      for (const s of res.solutions) expect(Math.abs(s.total_mm - target)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
