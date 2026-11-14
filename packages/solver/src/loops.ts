/**
 * Loop builder: "what complete loop can I build from my box?"
 *
 * Shapes, all built only from pieces the user owns, one track system and
 * one rail material at a time, one curve radius per plan:
 *  - circle and oval: two 180 degree ends, two equal straight sides;
 *  - rounded rectangle: four 90 degree corners, opposite sides equal;
 *  - figure eight: two lobes of (360 - c) degrees, turning opposite ways,
 *    through one crossing of angle c, with four equal straight legs of
 *    length R*tan(c/2) - crossing/2 (that is what makes it close).
 *
 * Rules every answer keeps (and the tests check): never more of a piece
 * than the user owns; pieces from one system and one rail material; the
 * traced path returns to its start point and heading (`tracePlan`).
 *
 * Dogbones and kidneys are not offered: they need bends the other way
 * whose closing depends on lengths that sectional sets rarely give
 * exactly, and this planner only offers shapes it can prove close.
 */

export interface LoopPiece {
  label: string;
  kind: "straight" | "curve" | "crossing";
  length_mm: number;
  radius_mm?: number;
  arc_degrees?: number;
  /** crossings: the angle between the two tracks */
  crossing_degrees?: number;
  qty: number;
  /** Pieces only join pieces of the same system. Undefined = "your own". */
  system_id?: string;
}

export interface LoopUse {
  label: string;
  kind: "straight" | "curve" | "crossing";
  length_mm: number;
  radius_mm?: number;
  arc_degrees?: number;
  count: number;
  /** curves: +1 turns left, -1 turns right (the piece laid the other way) */
  turn?: 1 | -1;
  /** second pass over the same crossing piece (not counted again) */
  repeat?: boolean;
}

export type LoopShape = "circle" | "oval" | "rectangle" | "figure-eight";

export interface LoopPlan {
  shape: LoopShape;
  system_id?: string;
  /** rail material when the brand sells more than one, else undefined */
  material?: string;
  radius_mm: number;
  /** ovals: one straight side; rectangles: the long side */
  side_mm: number;
  /** rectangles: the short side */
  side2_mm?: number;
  /** Pieces in running order, leg by leg. */
  sequence: LoopUse[];
  /** Leg names for the laying order, with index ranges into `sequence`. */
  legs: { name: string; from: number; to: number }[];
  /** Same pieces, counted (a crossing counted once). */
  parts: LoopUse[];
  /** Pieces of the same system and material still in the box afterwards. */
  leftovers: LoopUse[];
  /** Footprint measured to the track centre line. */
  width_mm: number;
  depth_mm: number;
  total_pieces: number;
  /** Total length of track laid, centre line. */
  run_mm: number;
  /** Set on the one plan that lays the most track. */
  uses_most?: boolean;
}

export interface LoopOptions {
  maxWidthMm?: number;
  maxDepthMm?: number;
  sideToleranceMm?: number;
  maxStates?: number;
}

export interface LoopResult {
  plans: LoopPlan[];
  reason?: string;
  nearest?: string;
  /** Why no figure eight was offered, when the box has curves for loops. */
  figureEightNote?: string;
}

type Pick = number[]; // count per type

/** Pair search: choose disjoint multisets A and B from typed pieces. */
function pairStates(
  units: number[],
  qtys: number[],
  capA: number,
  maxStates: number,
): Map<string, { a: number; b: number; pa: Pick; pb: Pick }> {
  let states = new Map<string, { a: number; b: number; pa: Pick; pb: Pick }>();
  const n = units.length;
  states.set("0,0", { a: 0, b: 0, pa: new Array(n).fill(0), pb: new Array(n).fill(0) });
  // Remaining capacity after type i, for pruning |a-b|.
  const restAfter: number[] = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) restAfter[i] = restAfter[i + 1]! + units[i]! * qtys[i]!;
  // One copy at a time: each copy goes to side A, side B, or stays in the
  // box. Equal (lo, hi) totals are merged, which keeps the search small.
  for (let i = 0; i < n; i++) {
    const u = units[i]!;
    for (let c = 0; c < qtys[i]!; c++) {
      const rest = restAfter[i + 1]! + u * (qtys[i]! - c - 1);
      const next = new Map(states);
      for (const s of states.values()) {
        for (const side of [0, 1]) {
          const a = s.a + (side === 0 ? u : 0);
          const b = s.b + (side === 1 ? u : 0);
          if (a > capA || b > capA) continue;
          if (Math.abs(a - b) > rest) continue;
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const key = lo + "," + hi;
          if (next.has(key)) continue;
          const pa = s.pa.slice();
          const pb = s.pb.slice();
          if (side === 0) pa[i]!++;
          else pb[i]!++;
          next.set(key, a >= b ? { a, b, pa, pb } : { a: b, b: a, pa: pb, pb: pa });
          if (next.size > maxStates) break;
        }
        if (next.size > maxStates) break;
      }
      // Drop states that can no longer close (the gap only shrinks by
      // pieces still to come).
      for (const [k, s] of next) if (s.a - s.b > rest) next.delete(k);
      states = next;
    }
  }
  return states;
}

/**
 * Large boxes: the exact pair search grows too fast, so build the two sides
 * from matching halves (the same pieces on both sides, which always
 * matches) and let the odd pieces left over make up a small extra on each
 * side when they can. Every answer is still a true closing loop; only the
 * very longest possible side may be missed in rare mixes.
 */
function symmetricStates(
  units: number[],
  qtys: number[],
  capA: number,
  tol: number,
): { a: number; b: number; pa: Pick; pb: Pick }[] {
  const n = units.length;
  const halves = qtys.map((q) => Math.floor(q / 2));
  // 0/1 knapsack over half copies, sums in the same units, parent pointers.
  const parent = new Map<number, number>(); // sum -> type index used to reach it
  parent.set(0, -1);
  let sums = [0];
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < halves[i]!; c++) {
      const add: number[] = [];
      for (const s of sums) {
        const t = s + units[i]!;
        if (t > capA || parent.has(t)) continue;
        parent.set(t, i);
        add.push(t);
      }
      sums = sums.concat(add);
      if (sums.length > 50000) break;
    }
  }
  const pickOf = (sum: number): Pick => {
    const p: Pick = new Array(n).fill(0);
    let s = sum;
    while (s > 0) {
      const i = parent.get(s)!;
      p[i]!++;
      s -= units[i]!;
    }
    return p;
  };
  // Odd copies left over: a small exact pair search on them.
  const oddQty = qtys.map((q, i) => q - 2 * halves[i]!);
  const extras = [...pairStates(units, oddQty, capA, 5000).values()].filter(
    (e) => e.a - e.b <= tol,
  );
  const out: { a: number; b: number; pa: Pick; pb: Pick }[] = [];
  const sorted = [...parent.keys()].sort((x, y) => x - y);
  const pickSym = (limit: number): number | null => {
    // largest symmetric sum <= limit
    let lo = 0, hi = sorted.length - 1, best: number | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid]! <= limit) { best = sorted[mid]!; lo = mid + 1; } else hi = mid - 1;
    }
    return best;
  };
  const seen = new Set<string>();
  const push = (sym: number, e: { a: number; b: number; pa: Pick; pb: Pick }) => {
    const a = sym + e.a;
    const b = sym + e.b;
    const key = a + "," + b;
    if (seen.has(key) || a > capA) return;
    seen.add(key);
    const ps = pickOf(sym);
    out.push({
      a,
      b,
      pa: ps.map((v, i) => v + e.pa[i]!),
      pb: ps.map((v, i) => v + e.pb[i]!),
    });
  };
  for (const e of extras) {
    const best = pickSym(capA - e.a);
    if (best !== null) push(best, e);
  }
  // A spread of sizes too, so the user sees small and medium ovals.
  for (const frac of [0.25, 0.5, 0.75]) {
    const target = sorted[Math.floor((sorted.length - 1) * frac)];
    if (target !== undefined) push(target, { a: 0, b: 0, pa: new Array(n).fill(0), pb: new Array(n).fill(0) });
  }
  if (sorted.length > 1) push(sorted[1]!, { a: 0, b: 0, pa: new Array(n).fill(0), pb: new Array(n).fill(0) });
  // Always try "every pair split down the middle" (all the halves), even
  // if the sums list was cut short. With no table limit this bounds the
  // miss: the side found is at most half the total length of the odd
  // pieces (one of each kind with an odd count) short of the longest
  // possible, because no side can exceed half of everything.
  const allHalves = halves.reduce((s, h, i) => s + h * units[i]!, 0);
  if (allHalves <= capA && !parent.has(allHalves)) {
    // Rebuild its pick directly: all halves.
    const a = allHalves;
    const key = a + "," + a;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ a, b: a, pa: halves.slice(), pb: halves.slice() });
    }
  } else if (allHalves <= capA) {
    push(allHalves, { a: 0, b: 0, pa: new Array(n).fill(0), pb: new Array(n).fill(0) });
  }
  for (const e of extras) {
    if (allHalves + e.a <= capA && parent.has(allHalves)) push(allHalves, e);
  }
  push(0, { a: 0, b: 0, pa: new Array(n).fill(0), pb: new Array(n).fill(0) });
  return out;
}

/** Above this many straight pieces the exact search gives way. */
const EXACT_LIMIT = 24;

const TENTH = 10; // straight lengths in tenths of a millimetre
const ARC_UNIT = 8; // curve sweep in eighths of a degree

/** Rail material from a label, for brands that sell steel and nickel silver. */
export function railMaterial(label: string): string | undefined {
  const l = label.toLowerCase();
  if (/nickel[ -]?silver/.test(l)) return "nickel silver";
  if (/\bsteel\b/.test(l)) return "steel";
  return undefined;
}

function groupKey(p: LoopPiece): string {
  return (p.system_id ?? "__own__") + "|" + (railMaterial(p.label) ?? "");
}

/** Crossing angle from the piece, or from its label ("90° crossing"). */
export function crossingAngle(p: { label: string; crossing_degrees?: number }): number | null {
  if (p.crossing_degrees && p.crossing_degrees > 0) return p.crossing_degrees;
  const m = p.label.match(/(\d+(?:\.\d+)?)\s*(?:°|deg|-degree| degree)/i);
  return m ? parseFloat(m[1]!) : null;
}

/**
 * One multiset of typed pieces whose sum is target (within tol), using at
 * most maxCounts[i] of each type. Prefers fewer pieces. null if none.
 */
function oneSum(units: number[], maxCounts: number[], target: number, tol: number): Pick | null {
  const n = units.length;
  let best: Pick | null = null;
  let bestN = Infinity;
  const cur: number[] = new Array(n).fill(0);
  let steps = 0;
  const go = (i: number, sum: number, used: number) => {
    if (++steps > 200000 || used >= bestN) return;
    if (Math.abs(sum - target) <= tol) {
      best = cur.slice();
      bestN = used;
      return;
    }
    if (i >= n || sum > target + tol) return;
    for (let c = Math.min(maxCounts[i]!, Math.floor((target + tol - sum) / units[i]!)); c >= 0; c--) {
      cur[i] = c;
      go(i + 1, sum + c * units[i]!, used + c);
    }
    cur[i] = 0;
  };
  go(0, 0, 0);
  return best;
}

export function findLoops(pieces: LoopPiece[], opts: LoopOptions = {}): LoopResult {
  const tol = Math.round((opts.sideToleranceMm ?? 1) * TENTH);
  const maxStates = opts.maxStates ?? 20000;
  const maxW = opts.maxWidthMm ?? Infinity;
  const maxD = opts.maxDepthMm ?? Infinity;

  const groups = new Map<string, LoopPiece[]>();
  for (const p of pieces) {
    if (!(p.qty > 0)) continue;
    const k = groupKey(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  // Pieces with no material go with every material of their system.
  for (const [k, g] of groups) {
    const [sys, mat] = k.split("|");
    if (!mat) continue;
    const plain = groups.get(sys + "|");
    if (plain) g.push(...plain);
  }
  for (const k of [...groups.keys()]) {
    const [sys, mat] = k.split("|");
    if (!mat && [...groups.keys()].some((o) => o.startsWith(sys + "|") && o !== k)) groups.delete(k);
  }

  const plans: LoopPlan[] = [];
  let bestCurveDeg = 0;
  let tooBig = false;
  let figureEightNote: string | undefined;

  for (const [gk, group] of groups) {
    const [sysPart, matPart] = gk.split("|");
    const system_id = sysPart === "__own__" ? undefined : sysPart;
    const material = matPart || undefined;
    const straights = mergeTypes(
      group.filter((p) => p.kind === "straight" && p.length_mm > 0),
      (p) => String(Math.round(p.length_mm * TENTH)),
    );
    const crossings = group.filter((p) => p.kind === "crossing");
    const byRadius = new Map<number, LoopPiece[]>();
    for (const c of group) {
      if (c.kind !== "curve" || !((c.radius_mm ?? 0) > 0 && (c.arc_degrees ?? 0) > 0)) continue;
      const r = Math.round(c.radius_mm!);
      if (!byRadius.has(r)) byRadius.set(r, []);
      byRadius.get(r)!.push(c);
    }
    const sUnits = straights.map((t) => Math.round(t.length_mm * TENTH));
    const sQty = straights.map((t) => t.qty);
    const copies = sQty.reduce((x, y) => x + y, 0);

    const make = (
      shape: LoopShape,
      legs: { name: string; run: LoopUse[] }[],
      R: number,
      side: number,
      side2: number | undefined,
      width: number,
      depth: number,
    ): LoopPlan => {
      const sequence: LoopUse[] = [];
      const legIdx: LoopPlan["legs"] = [];
      for (const l of legs) {
        if (!l.run.length) continue;
        legIdx.push({ name: l.name, from: sequence.length, to: sequence.length + l.run.length });
        sequence.push(...l.run);
      }
      const parts = countParts(sequence.filter((u) => !u.repeat));
      const run = sequence.reduce(
        (s, u) => s + (u.repeat ? 0 : u.kind === "curve" ? (Math.PI * u.radius_mm! * u.arc_degrees!) / 180 : u.length_mm),
        0,
      );
      return {
        shape,
        system_id,
        material,
        radius_mm: R,
        side_mm: side,
        side2_mm: side2,
        sequence,
        legs: legIdx,
        parts,
        leftovers: leftoversOf(group, parts),
        width_mm: width,
        depth_mm: depth,
        total_pieces: parts.reduce((s, p) => s + p.count, 0),
        run_mm: run,
      };
    };

    for (const [, cs] of byRadius) {
      const types = mergeTypes(cs, (p) => String(Math.round(p.arc_degrees! * ARC_UNIT)));
      const R = types[0]!.radius_mm!;
      const aUnits = types.map((t) => Math.round(t.arc_degrees! * ARC_UNIT));
      const aQty = types.map((t) => t.qty);
      const total = types.reduce((s, t) => s + t.arc_degrees! * t.qty, 0);
      if (total > bestCurveDeg) bestCurveDeg = total;
      const half = 180 * ARC_UNIT;
      const ends = pairStates(aUnits, aQty, half, maxStates).get(half + "," + half);
      if (!ends) continue;
      if (2 * R > maxD) {
        tooBig = true;
        continue;
      }
      const capSide = Math.floor(Math.min(1e9, (maxW - 2 * R) * TENTH));
      if (capSide < 0) {
        tooBig = true;
        continue;
      }
      const curveRun = (pick: Pick, turn: 1 | -1 = 1) => expand(types, pick).map((u) => ({ ...u, turn }));

      // ---- circles and ovals
      const sideList =
        copies <= EXACT_LIMIT
          ? [...pairStates(sUnits, sQty, capSide, maxStates).values()]
          : symmetricStates(sUnits, sQty, capSide, tol);
      const ok = sideList.filter((s) => s.a - s.b <= tol).sort((x, y) => y.b - x.b);
      const chosen: typeof ok = [];
      const nonZero = ok.filter((s) => s.b > 0);
      if (nonZero[0]) {
        chosen.push(nonZero[0]);
        const halfLen = nonZero[0].b / 2;
        const mid = nonZero.slice(1).reduce<(typeof ok)[number] | null>(
          (best, x) => (!best || Math.abs(x.b - halfLen) < Math.abs(best.b - halfLen) ? x : best),
          null,
        );
        if (mid && mid.b < nonZero[0].b * 0.8) chosen.push(mid);
      }
      const zero = ok.find((s) => s.a === 0 && s.b === 0);
      if (zero) chosen.push(zero);
      for (const s of chosen) {
        const side = Math.max(s.a, s.b) / TENTH;
        plans.push(
          make(
            s.a === 0 ? "circle" : "oval",
            [
              { name: "First side", run: expand(straights, s.pa) },
              { name: s.a === 0 ? "First half circle" : "First end (curves)", run: curveRun(ends.pa) },
              { name: "Second side", run: expand(straights, s.pb) },
              { name: s.a === 0 ? "Second half circle" : "Second end (curves)", run: curveRun(ends.pb) },
            ],
            R, side, undefined, side + 2 * R, 2 * R,
          ),
        );
      }

      // ---- rounded rectangle: four identical 90 degree corners
      const corner = oneSum(aUnits, aQty.map((q) => Math.floor(q / 4)), 90 * ARC_UNIT, 0);
      if (corner && nonZero.length) {
        const capB = Math.floor(Math.min(1e9, (maxD - 2 * R) * TENTH));
        let best: { A: (typeof ok)[number]; B: (typeof ok)[number] } | null = null;
        // Try the longest few long sides; fill the short sides from what is left.
        for (const A of nonZero.slice(0, 12)) {
          const rest = sQty.map((q, i) => q - A.pa[i]! - A.pb[i]!);
          const restCopies = rest.reduce((x, y) => x + y, 0);
          const bl =
            restCopies <= EXACT_LIMIT
              ? [...pairStates(sUnits, rest, Math.min(capB, A.b), maxStates).values()]
              : symmetricStates(sUnits, rest, Math.min(capB, A.b), tol);
          const B = bl.filter((s) => s.a - s.b <= tol && s.b > 0).sort((x, y) => y.b - x.b)[0];
          if (B && (!best || A.b + B.b > best.A.b + best.B.b)) best = { A, B };
        }
        if (best) {
          const a = Math.max(best.A.a, best.A.b) / TENTH;
          const b = Math.max(best.B.a, best.B.b) / TENTH;
          plans.push(
            make(
              "rectangle",
              [
                { name: "First long side", run: expand(straights, best.A.pa) },
                { name: "Corner (curves)", run: curveRun(corner) },
                { name: "First short side", run: expand(straights, best.B.pa) },
                { name: "Corner (curves)", run: curveRun(corner) },
                { name: "Second long side", run: expand(straights, best.A.pb) },
                { name: "Corner (curves)", run: curveRun(corner) },
                { name: "Second short side", run: expand(straights, best.B.pb) },
                { name: "Corner (curves)", run: curveRun(corner) },
              ],
              R, a, b, a + 2 * R, b + 2 * R,
            ),
          );
        }
      }

      // ---- figure eight through one crossing
      for (const x of crossings) {
        const ang = crossingAngle(x);
        const xl = x.length_mm;
        if (!ang || !(xl > 0)) {
          figureEightNote ??= `Your ${x.label} has no ${!ang ? "angle" : "length"} in the catalogue, so a figure eight through it cannot be checked.`;
          continue;
        }
        const leg = R * Math.tan((ang * Math.PI) / 360) - xl / 2;
        if (leg < -tol / TENTH) {
          figureEightNote ??= `A figure eight with your ${x.label} would need curves wider than ${Math.round(R)} mm radius.`;
          continue;
        }
        const lobe = oneSum(aUnits, aQty.map((q) => Math.floor(q / 2)), Math.round((360 - ang) * ARC_UNIT), 0);
        if (!lobe) {
          figureEightNote ??= `A figure eight through your ${x.label} needs two loops of ${360 - ang} degrees each of one curve size.`;
          continue;
        }
        const legPick =
          leg <= tol / TENTH ? new Array(straights.length).fill(0) : oneSum(sUnits, sQty.map((q) => Math.floor(q / 4)), Math.round(leg * TENTH), tol);
        if (!legPick) {
          figureEightNote ??= `A figure eight through your ${x.label} needs four straight runs of ${Math.round(leg)} mm each (between the crossing and the curves), and your straights do not make that exactly.`;
          continue;
        }
        const legRun = () => expand(straights, legPick);
        const legLen = legPick.reduce((s, c, i) => s + c * straights[i]!.length_mm, 0);
        const L = legLen + xl / 2;
        const half = (ang * Math.PI) / 360;
        const W = 2 * (L * Math.cos(half) + R * Math.sin(half)) + 2 * R;
        const D = 2 * R;
        if (W > maxW || D > maxD) {
          tooBig = true;
          continue;
        }
        const xUse: LoopUse = { label: x.label, kind: "crossing", length_mm: xl, count: 1 };
        plans.push(
          make(
            "figure-eight",
            [
              { name: "Crossing", run: [xUse] },
              { name: "Straight", run: legRun() },
              { name: "First loop (curves)", run: curveRun(lobe, 1) },
              { name: "Straight", run: legRun() },
              { name: "Through the crossing again", run: [{ ...xUse, repeat: true }] },
              { name: "Straight", run: legRun() },
              { name: "Second loop (curves, bending the other way)", run: curveRun(lobe, -1) },
              { name: "Straight", run: legRun() },
            ],
            R, legLen, undefined, W, D,
          ),
        );
      }
    }
  }

  if (plans.length) {
    // Most track laid first: the answer that uses the most of the box.
    plans.sort((a, b) => b.run_mm - a.run_mm || b.total_pieces - a.total_pieces);
    plans[0]!.uses_most = true;
    const hasEight = plans.some((p) => p.shape === "figure-eight");
    return { plans: plans.slice(0, 10), figureEightNote: hasEight ? undefined : figureEightNote };
  }

  if (bestCurveDeg === 0 && pieces.some((p) => p.qty > 0 && /\bflex/i.test(p.label))) {
    return {
      plans: [],
      reason:
        "Your list is flex track, which you bend to any shape you like. Trackfit plans loops from sectional pieces (fixed curves and straights), so it has nothing to draw here.",
      nearest:
        "For flex track, the gap filler below still helps: it tells you how long a piece to cut.",
    };
  }
  if (bestCurveDeg === 0) {
    const hasStraight = pieces.some((p) => p.kind === "straight" && p.qty > 0);
    return {
      plans: [],
      reason: hasStraight
        ? "A loop needs sectional curves, and your list has none with a count above 0."
        : "A loop needs sectional pieces, and your list has none with a count above 0.",
      nearest: "Set how many curves you own in step 2.",
    };
  }
  if (tooBig) {
    return {
      plans: [],
      reason: "You have the pieces for a loop, but even the smallest one is bigger than the space you gave.",
    };
  }
  const short = Math.max(0, 360 - bestCurveDeg);
  return {
    plans: [],
    reason: "A loop needs a full circle of curves of one size (360 degrees, half at each end).",
    nearest:
      short > 0
        ? `Your best curve size covers ${round1(bestCurveDeg)} degrees. You are ${round1(short)} degrees short of a full circle.`
        : "Your curves add up to a full circle, but they cannot be split into two equal half circles.",
  };
}

function round1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function mergeTypes(ps: LoopPiece[], key: (p: LoopPiece) => string): LoopPiece[] {
  const m = new Map<string, LoopPiece>();
  for (const p of ps) {
    const k = key(p) + "|" + p.label;
    const prev = m.get(k);
    if (prev) prev.qty += p.qty;
    else m.set(k, { ...p });
  }
  return [...m.values()];
}

function expand(types: LoopPiece[], pick: Pick): LoopUse[] {
  const out: LoopUse[] = [];
  types.forEach((t, i) => {
    for (let k = 0; k < (pick[i] ?? 0); k++) {
      out.push({
        label: t.label,
        kind: t.kind,
        length_mm: t.length_mm,
        radius_mm: t.radius_mm,
        arc_degrees: t.arc_degrees,
        count: 1,
      });
    }
  });
  return out;
}

const partKey = (u: { label: string; kind: string }) => u.kind + "|" + u.label;

function countParts(seq: LoopUse[]): LoopUse[] {
  const m = new Map<string, LoopUse>();
  for (const u of seq) {
    const k = partKey(u);
    const prev = m.get(k);
    if (prev) prev.count++;
    else m.set(k, { ...u, turn: undefined, count: 1 });
  }
  return [...m.values()].sort(
    (a, b) =>
      (a.kind === "curve" ? 1 : 0) - (b.kind === "curve" ? 1 : 0) ||
      b.length_mm - a.length_mm ||
      a.label.localeCompare(b.label),
  );
}

function leftoversOf(group: LoopPiece[], parts: LoopUse[]): LoopUse[] {
  const owned = new Map<string, LoopUse>();
  for (const p of group) {
    const k = partKey(p);
    const prev = owned.get(k);
    if (prev) prev.count += p.qty;
    else owned.set(k, { label: p.label, kind: p.kind, length_mm: p.length_mm, radius_mm: p.radius_mm, arc_degrees: p.arc_degrees, count: p.qty });
  }
  for (const u of parts) {
    const o = owned.get(partKey(u));
    if (o) o.count -= u.count;
  }
  return [...owned.values()].filter((u) => u.count > 0);
}

/** Turn a plan's leftovers back into pieces, for "what else could I build". */
export function leftoverPieces(plan: LoopPlan): LoopPiece[] {
  return plan.leftovers.map((u) => ({
    label: u.label,
    kind: u.kind,
    length_mm: u.length_mm,
    radius_mm: u.radius_mm,
    arc_degrees: u.arc_degrees,
    qty: u.count,
    system_id: plan.system_id,
  }));
}

export interface TracedSegment {
  kind: "straight" | "curve" | "crossing";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r?: number;
  arc?: number;
  /** curves: +1 left, -1 right */
  turn?: 1 | -1;
  label: string;
  repeat?: boolean;
}

/**
 * Lay the plan's pieces end to end and return each piece's start and end.
 * The loop closes when the last end point and heading equal the start.
 */
export function tracePlan(plan: LoopPlan): { segments: TracedSegment[]; end: { x: number; y: number; heading: number } } {
  let x = 0;
  let y = 0;
  let h = 0;
  const segments: TracedSegment[] = [];
  for (const p of plan.sequence) {
    if (p.kind !== "curve") {
      const nx = x + p.length_mm * Math.cos(h);
      const ny = y + p.length_mm * Math.sin(h);
      segments.push({ kind: p.kind, x0: x, y0: y, x1: nx, y1: ny, label: p.label, repeat: p.repeat });
      x = nx;
      y = ny;
    } else {
      const s = p.turn ?? 1;
      const r = p.radius_mm!;
      const a = (s * p.arc_degrees! * Math.PI) / 180;
      const cx = x - s * r * Math.sin(h);
      const cy = y + s * r * Math.cos(h);
      const nh = h + a;
      const nx = cx + s * r * Math.sin(nh);
      const ny = cy - s * r * Math.cos(nh);
      segments.push({ kind: "curve", x0: x, y0: y, x1: nx, y1: ny, r, arc: p.arc_degrees, turn: s, label: p.label });
      x = nx;
      y = ny;
      h = nh;
    }
  }
  return { segments, end: { x, y, heading: h } };
}
