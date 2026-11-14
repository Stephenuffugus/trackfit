import { findCombinations } from "./subset-sum.js";
import { railMaterial } from "./loops.js";
import type { InventoryItem, Solution, SolverResult } from "./types.js";

export interface MaterialSolverResult extends SolverResult {
  /** True when an answer within tolerance exists only by mixing rail materials. */
  mixedWouldFit?: boolean;
}

/**
 * The gap filler, one rail material per answer. Brands that sell the same
 * piece in steel and nickel silver say not to mix them electrically, so
 * each answer uses one material (pieces with no material go with either).
 */
export function findCombinationsOneMaterial(
  items: InventoryItem[],
  target_mm: number,
  tolerance_mm: number,
): MaterialSolverResult {
  const mats = [...new Set(items.map((i) => railMaterial(i.label)).filter(Boolean))] as string[];
  if (mats.length < 2) return findCombinations(items, target_mm, tolerance_mm);
  const runs = mats.map((m) =>
    findCombinations(
      items.filter((i) => {
        const im = railMaterial(i.label);
        return !im || im === m;
      }),
      target_mm,
      tolerance_mm,
    ),
  );
  const key = (s: Solution) => s.pieces.map((p) => `${p.label}x${p.count}`).sort().join("|");
  const seen = new Set<string>();
  const solutions: Solution[] = [];
  for (const r of runs) for (const s of r.solutions) {
    const k = key(s);
    if (!seen.has(k)) { seen.add(k); solutions.push(s); }
  }
  solutions.sort((a, b) => a.deviation_mm - b.deviation_mm || a.pieceCount - b.pieceCount);
  const pick = (xs: (Solution | null)[], better: (a: Solution, b: Solution) => boolean) =>
    xs.reduce<Solution | null>((best, s) => (s && (!best || better(s, best)) ? s : best), null);
  const out: MaterialSolverResult = {
    solutions,
    bestUnder: pick(runs.map((r) => r.bestUnder), (a, b) => a.total_mm > b.total_mm),
    bestOver: pick(runs.map((r) => r.bestOver), (a, b) => a.total_mm < b.total_mm),
  };
  if (solutions.length === 0) {
    out.mixedWouldFit = findCombinations(items, target_mm, tolerance_mm).solutions.length > 0;
  }
  return out;
}
