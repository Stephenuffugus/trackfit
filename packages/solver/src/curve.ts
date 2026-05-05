import { findCombinations } from "./subset-sum.js";
import type { InventoryItem, Solution, SolutionPiece } from "./types.js";

/**
 * Curve-aware (2D + heading) gap solver.
 *
 * This is a separate entry point from {@link findCombinations}; the 1D
 * subset-sum path stays bit-for-bit identical. See
 * `docs/curve-solver-design.md` for the math.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single piece in the curve solver's inventory. */
export interface CurveInventoryItem {
  /** display label, used for grouping / rendering */
  label: string;
  /**
   * "straight", "curve", or "turnout". Fitters are short straights.
   *
   * v1 turnout treatment: turnouts are modelled as a straight equivalent of
   * length `overall_length_mm` along the main route. The diverging path is
   * NOT searched — see "v2 turnout pathing" TODOs in pathLength/localExit
   * below.
   */
  kind: "straight" | "curve" | "turnout";
  /** straights/fitters: nominal length, mm. curves: arc length along centerline. */
  length_mm: number;
  /** curves only: radius along centerline */
  radius_mm?: number;
  /** curves only: arc sweep, degrees (always positive; direction is per-step). */
  arc_degrees?: number;
  /** turnouts only: overall length along main route, mm. v1 treats this as a straight length. */
  overall_length_mm?: number | null;
  /** turnouts only: divergence angle in degrees. Reserved for v2 turnout pathing. */
  divergence_degrees?: number | null;
  /** how many of this piece the user owns */
  qty: number;
  /** allow extra UI metadata to ride along */
  [extra: string]: unknown;
}

export interface CurveTarget {
  /** longitudinal advance along the entry tangent, mm */
  length_mm: number;
  /** signed lateral offset (left +, right −), mm */
  lateral_offset_mm: number;
  /** signed heading change, degrees */
  angle_degrees: number;
}

export interface CurveTolerance {
  length_mm: number;
  lateral_offset_mm: number;
  angle_degrees: number;
}

/** Step kept on a solution: which piece, and (for curves) which direction. */
export interface CurveSolutionStep extends SolutionPiece {
  /** "+1" left / counter-clockwise, "−1" right / clockwise. Always +1 for straights. */
  direction: 1 | -1;
}

export interface Pose {
  x_mm: number;
  y_mm: number;
  heading_degrees: number;
}

export interface CurveSolution {
  /** ordered list of placed pieces (the v0.2 order-doesn't-matter assumption is gone) */
  pieces: CurveSolutionStep[];
  /** end-of-chain pose in the entry-local frame */
  endpoint: Pose;
  /** signed per-axis residuals (endpoint − target) */
  residual: {
    length_mm: number;
    lateral_offset_mm: number;
    angle_degrees: number;
  };
  /** tolerance-normalised Euclidean score; 0 == perfect */
  score: number;
  /** number of pieces in the chain */
  pieceCount: number;
  /** sum of arc/path length over every piece */
  total_arc_length_mm: number;
}

/** A "missing piece" suggestion that would close the residual exactly. */
export type CurveMissingPiece =
  | { kind: "straight"; length_mm: number; message: string }
  | {
      kind: "curve";
      radius_mm: number;
      arc_degrees: number;
      direction: 1 | -1;
      message: string;
      below_nmra_minimum?: boolean;
    }
  | { kind: "mixed"; message: string };

export interface CurveSolverResult {
  /** exact fits within all three tolerances, best-first */
  solutions: CurveSolution[];
  /** smallest-score combo seen across the search (including pruned leaves) */
  bestNearMiss: CurveSolution | null;
  /** suggested missing piece(s) to close the gap exactly, when no exact fit */
  suggestion: CurveMissingPiece | null;
}

export interface CurveSolverOptions {
  /** cap the returned solutions list (default 20) */
  maxResults?: number;
  /** cap on cumulative |angle| during search; 720° default per design §4.1 */
  maxAngleSumDegrees?: number;
  /** cap on number of pieces; 20 default per design §4.1 */
  maxPieceCount?: number;
}

// ---------------------------------------------------------------------------
// Geometry primitives (design doc §2)
// ---------------------------------------------------------------------------

const DEG2RAD = Math.PI / 180;

/** Wrap an angle into (−180°, +180°]. */
export function wrapDegrees(deg: number): number {
  let d = ((deg + 180) % 360) - 180;
  // ((-180) % 360) === -180 in JS — push it up to +180 so the interval stays open at the bottom.
  if (d <= -180) d += 360;
  return d;
}

/** Path length (mm) of a single piece. */
function pathLength(p: CurveInventoryItem): number {
  if (p.kind === "straight") return p.length_mm;
  if (p.kind === "turnout") {
    // v1 turnout pathing: treat the turnout as a straight along its main route
    // of length `overall_length_mm`. Pieces with no published length contribute
    // nothing — see the validity filter in findCurveCombinations which excludes
    // them outright. TODO(v2 turnout pathing): model the diverging exit pose so
    // the solver can branch through the through-route AND the divergent route.
    return typeof p.overall_length_mm === "number" && p.overall_length_mm > 0
      ? p.overall_length_mm
      : 0;
  }
  // For curves prefer the canonical r·θ if both are present, else the stored length.
  if (
    typeof p.radius_mm === "number" &&
    typeof p.arc_degrees === "number" &&
    p.radius_mm > 0 &&
    p.arc_degrees > 0
  ) {
    return p.radius_mm * p.arc_degrees * DEG2RAD;
  }
  return p.length_mm;
}

/** Local exit pose of a piece in its entry-local frame (design §2.2). */
function localExit(p: CurveInventoryItem, dir: 1 | -1): Pose {
  if (p.kind === "straight") {
    return { x_mm: p.length_mm, y_mm: 0, heading_degrees: 0 };
  }
  if (p.kind === "turnout") {
    // v1 turnout pathing: emit the same exit pose as a straight whose length
    // equals `overall_length_mm`. This intentionally ignores the diverging
    // route — the through-route is geometrically straight, so only the main
    // path participates in the search. TODO(v2 turnout pathing): expose the
    // diverging exit `(x', y', divergence_degrees)` as an alternative branch
    // (similar to how curves expand on direction ±1). That doubles the branch
    // factor for every turnout and is deferred until the search-space cost is
    // understood.
    const len =
      typeof p.overall_length_mm === "number" && p.overall_length_mm > 0
        ? p.overall_length_mm
        : 0;
    return { x_mm: len, y_mm: 0, heading_degrees: 0 };
  }
  const r = p.radius_mm ?? 0;
  const arc = p.arc_degrees ?? 0;
  const t = arc * DEG2RAD;
  return {
    x_mm: r * Math.sin(t),
    y_mm: dir * r * (1 - Math.cos(t)),
    heading_degrees: dir * arc,
  };
}

/** Compose an absolute pose with a local exit (design §2.5). */
function compose(a: Pose, b: Pose): Pose {
  const r = a.heading_degrees * DEG2RAD;
  const cs = Math.cos(r);
  const sn = Math.sin(r);
  return {
    x_mm: a.x_mm + b.x_mm * cs - b.y_mm * sn,
    y_mm: a.y_mm + b.x_mm * sn + b.y_mm * cs,
    heading_degrees: a.heading_degrees + b.heading_degrees,
  };
}

// Public re-exports of the primitives — handy for callers that want to draw
// the chain on a canvas without re-deriving the math.
export const _internal = { localExit, compose, pathLength, wrapDegrees };

// ---------------------------------------------------------------------------
// Scoring + residuals (design doc §3)
// ---------------------------------------------------------------------------

interface Residual {
  r_long: number;
  r_lat: number;
  r_angle: number;
}

function residualOf(pose: Pose, target: CurveTarget): Residual {
  return {
    r_long: pose.x_mm - target.length_mm,
    r_lat: pose.y_mm - target.lateral_offset_mm,
    r_angle: wrapDegrees(pose.heading_degrees - target.angle_degrees),
  };
}

function scoreOf(res: Residual, tol: CurveTolerance): number {
  const a = res.r_long / tol.length_mm;
  const b = res.r_lat / tol.lateral_offset_mm;
  const c = res.r_angle / tol.angle_degrees;
  return Math.sqrt(a * a + b * b + c * c);
}

function withinTolerance(res: Residual, tol: CurveTolerance): boolean {
  return (
    Math.abs(res.r_long) <= tol.length_mm + 1e-9 &&
    Math.abs(res.r_lat) <= tol.lateral_offset_mm + 1e-9 &&
    Math.abs(res.r_angle) <= tol.angle_degrees + 1e-9
  );
}

// ---------------------------------------------------------------------------
// Inches helper for suggestion messages
// ---------------------------------------------------------------------------
const IN_TO_MM = 25.4;

// ---------------------------------------------------------------------------
// Suggestion synthesis (design §5)
// ---------------------------------------------------------------------------

/** NMRA RP-11 "Conventional" minimum radii in mm, per scale. Used for §5.4. */
const NMRA_RP11_CONVENTIONAL_MM: Record<string, number> = {
  Z: 195,
  N: 228,
  TT: 318,
  HO: 457,
  OO: 438,
  S: 762,
  O: 1067,
  G: 1219,
};

function buildSuggestion(
  near: CurveSolution | null,
  tol: CurveTolerance,
  scale?: string,
): CurveMissingPiece | null {
  if (!near) return null;
  const r_long = near.residual.length_mm;
  const r_lat = near.residual.lateral_offset_mm;
  const r_angle = near.residual.angle_degrees;
  const lateralOk = Math.abs(r_lat) <= tol.lateral_offset_mm + 1e-9;
  const angleOk = Math.abs(r_angle) <= tol.angle_degrees + 1e-9;
  const lengthOk = Math.abs(r_long) <= tol.length_mm + 1e-9;

  // §5.3 — straight-dominated: lat & angle in tolerance, length is not.
  if (lateralOk && angleOk && !lengthOk) {
    // The "missing" straight has length = target − endpoint = −r_long.
    const need = -r_long;
    const inches = need / IN_TO_MM;
    const message = `Add a straight piece of length ${need.toFixed(1)} mm (≈ ${inches.toFixed(2)} in) to close the gap exactly.`;
    return { kind: "straight", length_mm: need, message };
  }

  // §5.4 — curve-dominated: length is in tolerance, lateral and/or angle are not.
  if (lengthOk && (!lateralOk || !angleOk) && Math.abs(r_angle) > 1e-9) {
    // Need a single curve that adds exactly (−r_lat, −r_angle) to the chain.
    // Direction handled by sign of (target − endpoint) angle.
    const needAngle = -r_angle;
    const needLat = -r_lat;
    const t = needAngle * DEG2RAD;
    const denom = 1 - Math.cos(t);
    if (Math.abs(denom) < 1e-9) {
      return {
        kind: "mixed",
        message: residualSentence(near),
      };
    }
    const radius = Math.abs(needLat / denom);
    const arc = Math.abs(needAngle);
    const direction: 1 | -1 = needAngle >= 0 ? 1 : -1;
    const min = scale ? NMRA_RP11_CONVENTIONAL_MM[scale] : undefined;
    const belowMin = typeof min === "number" && radius < min;
    const message =
      `A single curve of radius ${radius.toFixed(0)} mm and arc ${arc.toFixed(0)}° would close it.` +
      (belowMin
        ? ` This is tighter than NMRA RP-11 recommends for ${scale}; consider revising the layout.`
        : "");
    const out: CurveMissingPiece = {
      kind: "curve",
      radius_mm: Math.round(radius),
      arc_degrees: Math.round(arc),
      direction,
      message,
    };
    if (belowMin) out.below_nmra_minimum = true;
    return out;
  }

  // §5.5 — mixed residual: don't invent a piece.
  return { kind: "mixed", message: residualSentence(near) };
}

function residualSentence(near: CurveSolution): string {
  const r = near.residual;
  const parts: string[] = [];
  if (Math.abs(r.length_mm) > 1e-6) {
    if (r.length_mm < 0) parts.push(`${(-r.length_mm).toFixed(1)} mm short`);
    else parts.push(`${r.length_mm.toFixed(1)} mm long`);
  }
  if (Math.abs(r.lateral_offset_mm) > 1e-6) {
    if (r.lateral_offset_mm < 0)
      parts.push(`${(-r.lateral_offset_mm).toFixed(1)} mm to the right`);
    else parts.push(`${r.lateral_offset_mm.toFixed(1)} mm to the left`);
  }
  if (Math.abs(r.angle_degrees) > 1e-6) {
    if (r.angle_degrees < 0)
      parts.push(`${(-r.angle_degrees).toFixed(1)}° under-rotated`);
    else parts.push(`${r.angle_degrees.toFixed(1)}° over-rotated`);
  }
  if (parts.length === 0) return "Within tolerance.";
  return `You'd be ${parts.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// Search (design §4)
// ---------------------------------------------------------------------------

interface SearchStep {
  itemIndex: number;
  direction: 1 | -1;
}

// ---------------------------------------------------------------------------
// All-straight fast path (design §4 — search; §5.3 — straight suggestion).
//
// When the inventory has no curves, the chain can only advance along the
// entry tangent — y stays 0 and heading stays 0. So:
//   * If target.lateral_offset_mm == 0 and target.angle_degrees == 0, the
//     problem reduces exactly to v0.2's bounded subset-sum on length_mm.
//     We translate `findCombinations` results into `CurveSolution`s.
//   * Otherwise no exact fit can exist (straights can't change y or h).
//     We still run the 1D solver on length to surface a length-only
//     bestNearMiss and a §5.5 "mixed" suggestion explaining the situation.
// ---------------------------------------------------------------------------
function solveAllStraight(
  inv: CurveInventoryItem[],
  target: CurveTarget,
  tol: CurveTolerance,
  maxResults: number,
): CurveSolverResult {
  // Convert curve-inventory items to the 1D inventory shape. Carry through the
  // full original CurveInventoryItem so that `kind`, label, etc. survive into
  // the translated solutions.
  //
  // v1 turnout pathing: turnouts with a published `overall_length_mm` qualify
  // for the all-straight fast path because their through-route is geometrically
  // a straight of that length. Length is sourced from `overall_length_mm` (NOT
  // `length_mm`, which on a turnout is typically null). TODO(v2 turnout
  // pathing): the diverging branch will not fit the 1D fast path — the solver
  // will have to fall through to the 2D recursion when any turnout is selected
  // for divergence.
  const items1d: InventoryItem[] = inv
    .filter((it) => {
      if (it.qty <= 0) return false;
      if (it.kind === "straight") return it.length_mm > 0;
      if (it.kind === "turnout") return (it.overall_length_mm ?? 0) > 0;
      return false;
    })
    .map((it) => {
      const length =
        it.kind === "turnout"
          ? (it.overall_length_mm as number)
          : it.length_mm;
      return {
        ...it,
        label: it.label,
        length_mm: length,
        qty: it.qty,
      };
    });

  const lateralOk = Math.abs(target.lateral_offset_mm) <= tol.lateral_offset_mm + 1e-9;
  const angleOk = Math.abs(target.angle_degrees) <= tol.angle_degrees + 1e-9;

  // Translate a 1D Solution into a CurveSolution. Each `count` becomes that
  // many sequential identical steps (direction = +1 since straights only).
  const toCurveSolution = (sol: Solution): CurveSolution => {
    const pieces: CurveSolutionStep[] = [];
    for (const p of sol.pieces) {
      // Find the matching original CurveInventoryItem so we preserve any
      // extra metadata; fall back to the 1D shape if not found.
      // Turnouts are matched by label + overall_length_mm because their
      // `length_mm` field is typically null/0 (the real length lives on
      // `overall_length_mm`); v1 turnout pathing translated that into the
      // synthesized 1D piece's `length_mm` above.
      const orig =
        inv.find(
          (it) =>
            it.label === p.label &&
            (it.length_mm === p.length_mm ||
              (it.kind === "turnout" && it.overall_length_mm === p.length_mm)),
        ) ?? (p as unknown as CurveInventoryItem);
      for (let k = 0; k < p.count; k++) {
        pieces.push({
          ...orig,
          count: 1,
          direction: 1,
        });
      }
    }
    const r_long = sol.total_mm - target.length_mm;
    const r_lat = -target.lateral_offset_mm;
    const r_angle = wrapDegrees(-target.angle_degrees);
    const score = scoreOf({ r_long, r_lat, r_angle }, tol);
    return {
      pieces,
      endpoint: { x_mm: sol.total_mm, y_mm: 0, heading_degrees: 0 },
      residual: {
        length_mm: r_long,
        lateral_offset_mm: r_lat,
        angle_degrees: r_angle,
      },
      score,
      pieceCount: pieces.length,
      total_arc_length_mm: sol.total_mm,
    };
  };

  // Run the 1D solver with the longitudinal target and tolerance.
  const r1d = findCombinations(items1d, target.length_mm, tol.length_mm, maxResults);

  // Pick the best near-miss the 1D solver surfaced. Use score (not raw
  // deviation) so the curve-aware contract is preserved if both sides exist.
  let bestNear: CurveSolution | null = null;
  const candidates: CurveSolution[] = [];
  if (r1d.bestUnder) candidates.push(toCurveSolution(r1d.bestUnder));
  if (r1d.bestOver) candidates.push(toCurveSolution(r1d.bestOver));
  for (const c of candidates) {
    if (!bestNear || c.score < bestNear.score) bestNear = c;
  }

  if (lateralOk && angleOk) {
    // Pure-1D problem: translate solutions and use the standard suggestion
    // builder, which (per §5.3) emits the v0.2 "add a straight piece" string
    // when the residual is length-only.
    const solutions = r1d.solutions.map(toCurveSolution);
    // If we have a within-tolerance solution, prefer it as the "best" near.
    if (solutions.length > 0) {
      const top = solutions[0]!;
      if (!bestNear || top.score < bestNear.score) bestNear = top;
    }
    const suggestion =
      solutions.length === 0 ? buildSuggestion(bestNear, tol) : null;
    return {
      solutions,
      bestNearMiss: bestNear,
      suggestion,
    };
  }

  // Lateral and/or angular target is non-zero — no straights-only chain can
  // ever satisfy it. Surface a length-only near-miss and a §5.5-style mixed
  // suggestion explaining the situation.
  return {
    solutions: [],
    bestNearMiss: bestNear,
    suggestion: {
      kind: "mixed",
      message: "Your gap requires a turn but you only have straight pieces.",
    },
  };
}

/**
 * Branch-and-bound search for ordered piece chains that hit the 3-axis target.
 *
 * @param inv      track inventory (straights and curves)
 * @param target   desired endpoint pose
 * @param tol      per-axis tolerance window
 * @param options  search caps and result count
 */
export function findCurveCombinations(
  inv: CurveInventoryItem[],
  target: CurveTarget,
  tol: CurveTolerance,
  options: CurveSolverOptions & { scale?: string } = {},
): CurveSolverResult {
  const maxResults = options.maxResults ?? 20;
  const maxAngleSum = options.maxAngleSumDegrees ?? 720;
  // Design §4.4 — explicit guidance is "cap piece count at 12 (most fills ≤ 8)".
  // The previous default of 20 makes the recursive search blow up on dense
  // inventories (20 types × 30 qty) before the reachability prunes can fire.
  // Callers that genuinely need deeper chains (helices, etc.) can still raise
  // this via options.maxPieceCount.
  const maxPieceCount = options.maxPieceCount ?? 12;

  // -------------------------------------------------------------------------
  // All-straight fast path — design §4 (search) + §5.3 (straight-dominated
  // suggestion). When the inventory contains zero curves, the 2D problem
  // collapses to v0.2's 1D subset-sum: lateral and angular axes can't move,
  // so they must already be zero or no exact fit exists. Either way, delegate
  // to the proven (≈1ms) `findCombinations` solver instead of running the
  // recursive 2D search. This collapses the v0.2 atlas regression from ~70s
  // to single-digit milliseconds.
  // -------------------------------------------------------------------------
  const hasCurve = inv.some((it) => it.kind === "curve" && it.qty > 0);
  if (!hasCurve) {
    return solveAllStraight(inv, target, tol, maxResults);
  }

  // Filter and sort by descending path length (design §4.3).
  // v1 turnout pathing: keep turnouts that have a published `overall_length_mm`;
  // they participate as straight equivalents along the main route. Drop turnouts
  // with no published length — we don't invent a length. TODO(v2 turnout
  // pathing): when the diverging branch is modelled, this filter will also need
  // `divergence_degrees` to be present.
  const valid = inv.filter(
    (it) =>
      it.qty > 0 &&
      ((it.kind === "straight" && it.length_mm > 0) ||
        (it.kind === "curve" &&
          (it.radius_mm ?? 0) > 0 &&
          (it.arc_degrees ?? 0) > 0) ||
        (it.kind === "turnout" && (it.overall_length_mm ?? 0) > 0)),
  );
  const sorted = [...valid].sort((a, b) => pathLength(b) - pathLength(a));

  const lengthBound = Math.abs(target.length_mm) * 1.5 + tol.length_mm;
  // For pure-rotational targets the longitudinal bound would be tiny; ensure
  // we still allow chains long enough to reach the lateral target.
  const lateralReach = Math.abs(target.lateral_offset_mm) * 1.5 + tol.lateral_offset_mm;
  const totalReach = Math.max(lengthBound, lateralReach, 1);

  const remaining = sorted.map((p) => p.qty);
  // Per-piece reachability stats — used to bound the remaining-inventory's
  // contribution to length, arc, and lateral displacement (design §4.2).
  const pieceLen = sorted.map(pathLength);
  const pieceArc = sorted.map((p) =>
    p.kind === "curve" ? p.arc_degrees ?? 0 : 0,
  );
  const pieceLatCap = sorted.map((p) =>
    p.kind === "curve" ? 2 * (p.radius_mm ?? 0) : 0,
  );

  // Sum across remaining inventory (capacity bounds).
  let remLen = 0;
  let remArc = 0;
  let remLat = 0;
  for (let i = 0; i < sorted.length; i++) {
    remLen += pieceLen[i]! * remaining[i]!;
    remArc += pieceArc[i]! * remaining[i]!;
    remLat += pieceLatCap[i]! * remaining[i]!;
  }

  const stack: SearchStep[] = [];
  const solutions: CurveSolution[] = [];
  let bestNear: CurveSolution | null = null;

  function snapshot(pose: Pose, pathLen: number): CurveSolution {
    // Preserve placement order in the returned chain. Each step carries the
    // full inventory metadata + a direction sign; `count: 1` keeps the shape
    // compatible with v0.2's SolutionPiece (which has a `count` field).
    const pieces: CurveSolutionStep[] = stack.map((s) => {
      const item = sorted[s.itemIndex] as CurveInventoryItem;
      return {
        ...item,
        count: 1,
        direction: s.direction,
      };
    });

    const residual = residualOf(pose, target);
    const score = scoreOf(residual, tol);
    return {
      pieces,
      endpoint: pose,
      residual: {
        length_mm: residual.r_long,
        lateral_offset_mm: residual.r_lat,
        angle_degrees: residual.r_angle,
      },
      score,
      pieceCount: pieces.length,
      total_arc_length_mm: pathLen,
    };
  }

  // Track the best score seen so far without snapshotting every node — only
  // build the (allocated) snapshot if a node beats the current best.
  let bestNearScore = Infinity;
  let bestNearPieceCount = Infinity;

  function recordNearLite(pose: Pose, pathLen: number, score: number): void {
    if (
      score < bestNearScore ||
      (score === bestNearScore && stack.length < bestNearPieceCount)
    ) {
      bestNearScore = score;
      bestNearPieceCount = stack.length;
      bestNear = snapshot(pose, pathLen);
    }
  }

  function recurse(pose: Pose, pathLen: number, angleSum: number): void {
    if (stack.length > maxPieceCount) return;

    // ALWAYS evaluate the current node first (skip the empty initial stack —
    // no useful pose). The caller has already enforced the angle-sum cap.
    if (stack.length > 0) {
      const res = residualOf(pose, target);
      const score = scoreOf(res, tol);
      if (withinTolerance(res, tol)) {
        solutions.push(snapshot(pose, pathLen));
      }
      recordNearLite(pose, pathLen, score);
    }

    // Hard length bound — past this, the chain can't be a useful base; stop
    // descending (we already recorded the leaf above).
    if (pathLen > totalReach + tol.length_mm) return;
    if (angleSum > maxAngleSum) return;

    // -----------------------------------------------------------------------
    // Reachability prunes (design §4.2). These all check: can the *remaining*
    // inventory possibly close the residual on a given axis? If not, prune the
    // entire subtree. Bounds are conservative — the chord of any piece is at
    // most its path length; lateral shift per piece is at most 2·radius for
    // curves (straights contribute 0). These prunes fire even at the root so
    // that an obviously-undercapacity inventory short-circuits immediately.
    // -----------------------------------------------------------------------

    // §4.2 — longitudinal reachability: |target_length − current_length|
    // must be coverable by the sum of remaining piece path lengths (plus tol).
    const longGap = target.length_mm - pose.x_mm;
    if (Math.abs(longGap) > remLen + tol.length_mm) return;

    // §4.2 — angular reachability: |target_angle − current_angle| must be
    // coverable by the sum of remaining curve arc_degrees (plus tol).
    // Straights contribute 0 to remArc so the bound stays tight.
    const angGap = wrapDegrees(target.angle_degrees - pose.heading_degrees);
    if (Math.abs(angGap) > remArc + tol.angle_degrees) return;

    // §4.2 — lateral reachability: bounded by Σ 2·r_i over remaining curves
    // plus the worst-case projection of remaining length (when a chain ends
    // already heading sideways).
    const latGap = target.lateral_offset_mm - pose.y_mm;
    if (Math.abs(latGap) > remLat + remLen + tol.lateral_offset_mm) return;

    // Cap the depth.
    if (stack.length === maxPieceCount) return;

    for (let i = 0; i < sorted.length; i++) {
      if ((remaining[i] ?? 0) === 0) continue;
      const piece = sorted[i] as CurveInventoryItem;
      const dirs: (1 | -1)[] = piece.kind === "curve" ? [1, -1] : [1];
      for (const d of dirs) {
        const exit = localExit(piece, d);
        const next = compose(pose, exit);
        const nLen = pathLen + pathLength(piece);
        const nAng =
          angleSum + (piece.kind === "curve" ? (piece.arc_degrees ?? 0) : 0);
        if (nAng > maxAngleSum) continue;

        const pl = pieceLen[i]!;
        const pa = pieceArc[i]!;
        const plat = pieceLatCap[i]!;
        remaining[i] = (remaining[i] ?? 0) - 1;
        remLen -= pl;
        remArc -= pa;
        remLat -= plat;
        stack.push({ itemIndex: i, direction: d });
        recurse(next, nLen, nAng);
        stack.pop();
        remaining[i] = (remaining[i] ?? 0) + 1;
        remLen += pl;
        remArc += pa;
        remLat += plat;
      }
    }
  }

  recurse({ x_mm: 0, y_mm: 0, heading_degrees: 0 }, 0, 0);

  // Dedupe identical solutions (same ordered piece sequence + same directions).
  const seen = new Set<string>();
  const dedup: CurveSolution[] = [];
  for (const s of solutions) {
    const key = s.pieces
      .map((p) => `${p.label}|${p.length_mm}|${p.radius_mm ?? ""}|${p.arc_degrees ?? ""}|${p.direction}`)
      .join(">>");
    if (!seen.has(key)) {
      seen.add(key);
      dedup.push(s);
    }
  }

  dedup.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 1e-9) return a.score - b.score;
    return a.pieceCount - b.pieceCount;
  });

  const trimmed = dedup.slice(0, maxResults);

  const suggestion =
    trimmed.length === 0 ? buildSuggestion(bestNear, tol, options.scale) : null;

  return {
    solutions: trimmed,
    bestNearMiss: bestNear,
    suggestion,
  };
}
