import type {
  InventoryItem,
  Solution,
  SolutionPiece,
  SolverResult,
} from "./types.js";

/**
 * Bounded subset-sum solver, ported verbatim from Trackfit v0.2.
 *
 * Returns:
 *  - `solutions`: combinations within ±tolerance of target, sorted best-first
 *    (by absolute deviation, then by lower piece count).
 *  - `bestUnder`: the largest total still UNDER target. This is the basis for
 *    the v0.2 "missing piece" near-miss suggestion: target_mm - bestUnder.total_mm
 *    is exactly the length of the single piece you'd need to add to your box.
 *  - `bestOver`: the smallest total that overshoots target+tolerance.
 *
 * Pruning strategy:
 *  - For each piece type, the inner loop is capped at min(qty, floor(target /
 *    length)) — we never enumerate quantities that obviously exceed the gap.
 *  - The recursion bails out as soon as the running total exceeds
 *    target+tolerance (after recording an over-miss candidate).
 *
 * For typical inventories (≤12 piece types, qty ≤30 each) this is fast: <2ms.
 */
export function findCombinations(
  items: InventoryItem[],
  target_mm: number,
  tolerance_mm: number,
  maxResults = 20,
): SolverResult {
  const valid = items.filter((it) => it.length_mm > 0 && it.qty > 0);
  const solutions: Solution[] = [];
  let bestUnder: Solution | null = null;
  let bestOver: Solution | null = null;
  const counts: number[] = new Array(valid.length).fill(0);

  function snapshot(total: number): Solution | null {
    let pieceCount = 0;
    for (const c of counts) pieceCount += c;
    if (pieceCount === 0) return null;

    const pieces: SolutionPiece[] = [];
    for (let i = 0; i < valid.length; i++) {
      const c = counts[i] ?? 0;
      if (c > 0) {
        pieces.push({ ...(valid[i] as InventoryItem), count: c });
      }
    }

    return {
      pieces,
      total_mm: total,
      deviation_mm: Math.abs(total - target_mm),
      pieceCount,
    };
  }

  function isBetterCandidate(a: Solution, b: Solution | null): boolean {
    if (!b) return true;
    if (a.deviation_mm < b.deviation_mm) return true;
    if (a.deviation_mm === b.deviation_mm && a.pieceCount < b.pieceCount) {
      return true;
    }
    return false;
  }

  function recurse(idx: number, total: number): void {
    // Overshoot: record best-over candidate, then prune.
    if (total > target_mm + tolerance_mm) {
      const sol = snapshot(total);
      if (sol && isBetterCandidate(sol, bestOver)) {
        bestOver = sol;
      }
      return;
    }

    if (idx === valid.length) {
      const sol = snapshot(total);
      if (!sol) return;
      if (sol.deviation_mm <= tolerance_mm) {
        solutions.push(sol);
      } else {
        // Within prune bound but outside tolerance ⇒ under-miss.
        if (isBetterCandidate(sol, bestUnder)) {
          bestUnder = sol;
        }
      }
      return;
    }

    const item = valid[idx] as InventoryItem;
    const maxN = Math.min(
      item.qty,
      Math.floor((target_mm + tolerance_mm) / item.length_mm),
    );
    for (let n = 0; n <= maxN; n++) {
      counts[idx] = n;
      recurse(idx + 1, total + n * item.length_mm);
    }
    counts[idx] = 0;
  }

  recurse(0, 0);

  solutions.sort((a, b) => {
    if (Math.abs(a.deviation_mm - b.deviation_mm) > 1e-6) {
      return a.deviation_mm - b.deviation_mm;
    }
    return a.pieceCount - b.pieceCount;
  });

  return {
    solutions: solutions.slice(0, maxResults),
    bestUnder,
    bestOver,
  };
}
