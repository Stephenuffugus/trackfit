/// <reference lib="webworker" />
/**
 * Solver web-worker.
 *
 * The curve solver can spend ~1.8s on dense inventories; running it on the
 * main thread freezes scroll/touch on phones, which is exactly the audience
 * we can't afford to lose. This worker takes the request, dispatches to the
 * 1D or 2D solver, and posts a typed result back.
 *
 * Wire-protocol — keep these shapes flat so structured-clone is cheap:
 *   request:  { id, kind: "straight", items, target_mm, tolerance_mm }
 *           | { id, kind: "curve",    items, target,    tolerance }
 *   response: { id, ok: true,  result } | { id, ok: false, error }
 *
 * The `id` lets App.tsx ignore stale responses when the user re-submits
 * before the previous solve finishes.
 */

import {
  findCombinations,
  findCurveCombinations,
  type CurveInventoryItem,
  type CurveSolverResult,
  type CurveTarget,
  type CurveTolerance,
  type InventoryItem,
  type SolverResult,
} from "@trackfit/solver";

export type SolverRequest =
  | {
      id: number;
      kind: "straight";
      items: InventoryItem[];
      target_mm: number;
      tolerance_mm: number;
    }
  | {
      id: number;
      kind: "curve";
      items: CurveInventoryItem[];
      target: CurveTarget;
      tolerance: CurveTolerance;
    };

export type SolverResponse =
  | {
      id: number;
      ok: true;
      kind: "straight";
      result: SolverResult;
      elapsed_ms: number;
    }
  | {
      id: number;
      ok: true;
      kind: "curve";
      result: CurveSolverResult;
      elapsed_ms: number;
    }
  | {
      id: number;
      ok: false;
      error: string;
    };

// `self` in a module worker is DedicatedWorkerGlobalScope.
const ctx: DedicatedWorkerGlobalScope =
  self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (e: MessageEvent<SolverRequest>) => {
  const req = e.data;
  try {
    const t0 = performance.now();
    if (req.kind === "straight") {
      const result = findCombinations(req.items, req.target_mm, req.tolerance_mm);
      const out: SolverResponse = {
        id: req.id,
        ok: true,
        kind: "straight",
        result,
        elapsed_ms: performance.now() - t0,
      };
      ctx.postMessage(out);
    } else {
      const result = findCurveCombinations(req.items, req.target, req.tolerance);
      const out: SolverResponse = {
        id: req.id,
        ok: true,
        kind: "curve",
        result,
        elapsed_ms: performance.now() - t0,
      };
      ctx.postMessage(out);
    }
  } catch (err) {
    const out: SolverResponse = {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    ctx.postMessage(out);
  }
});

// Keeps TS from treating this as a script (we want module-worker semantics so
// `import` works). Vite's `?worker` import handles the bundling.
export {};
