/**
 * Loop builder: "what complete loop can I build from my box?"
 *
 * Finds closed ovals (and plain circles) that use only the pieces the user
 * owns. An oval is two half circles (180 degrees each, one radius) joined
 * by two straight sides of equal length. That shape closes exactly, so a
 * plan from here is one a person can actually lay on the floor.
 *
 * Rules the answer always keeps (and the tests check):
 *  - pieces from one track system only (different systems do not join);
 *  - never more of a piece than the user owns;
 *  - both ends use curves of one radius, 180 degrees each;
 *  - both straight sides match to within `sideToleranceMm`;
 *  - the drawn path returns to its start (see `tracePlan`).
 */

export interface LoopPiece {
  label: string;
  kind: "straight" | "curve";
  length_mm: number;
  radius_mm?: number;
  arc_degrees?: number;
  qty: number;
  /** Pieces only join pieces of the same system. Undefined = "your own". */
  system_id?: string;
}

export interface LoopUse {
  label: string;
  kind: "straight" | "curve";
  length_mm: number;
  radius_mm?: number;
  arc_degrees?: number;
  count: number;
}

export interface LoopPlan {
  /** "circle" when the sides are empty, else "oval". */
  shape: "circle" | "oval";
  system_id?: string;
  radius_mm: number;
  /** Length of ONE straight side, centre line. */
  side_mm: number;
  /** Pieces in running order: side A, end 1, side B, end 2. */
  sequence: LoopUse[];
  /** Same pieces, counted. */
  parts: LoopUse[];
  /** Footprint measured to the track centre line. */
  width_mm: number;
  depth_mm: number;
  total_pieces: number;
}

export interface LoopOptions {
  /** Max footprint (centre line), mm. Plans larger than this are dropped. */
  maxWidthMm?: number;
  maxDepthMm?: number;
  /** How far apart the two sides may be and still count as equal. */
  sideToleranceMm?: number;
  /** Safety valve for huge inventories. */
  maxStates?: number;
}

export interface LoopResult {
  plans: LoopPlan[];
  /** Plain reason when `plans` is empty. */
  reason?: string;
  /** Best "you are close" hint when nothing closes. */
  nearest?: string;
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
  push(0, { a: 0, b: 0, pa: new Array(n).fill(0), pb: new Array(n).fill(0) });
  return out;
}

/** Above this many straight pieces the exact search gives way. */
const EXACT_LIMIT = 24;

const TENTH = 10; // straight lengths in tenths of a millimetre
const ARC_UNIT = 8; // curve sweep in eighths of a degree

function groupKey(p: LoopPiece): string {
  return p.system_id ?? "__own__";
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

  const plans: LoopPlan[] = [];
  let bestCurveDeg = 0;
  let bestCurveRadius = 0;
  let tooBig = false;

  for (const [gk, group] of groups) {
    const straights = mergeTypes(
      group.filter((p) => p.kind === "straight" && p.length_mm > 0),
      (p) => String(Math.round(p.length_mm * TENTH)),
    );
    const curves = group.filter(
      (p) => p.kind === "curve" && (p.radius_mm ?? 0) > 0 && (p.arc_degrees ?? 0) > 0,
    );
    // Curves by radius (rounded to 1 mm).
    const byRadius = new Map<number, LoopPiece[]>();
    for (const c of curves) {
      const r = Math.round(c.radius_mm!);
      if (!byRadius.has(r)) byRadius.set(r, []);
      byRadius.get(r)!.push(c);
    }
    for (const [r, cs] of byRadius) {
      const types = mergeTypes(cs, (p) => String(Math.round(p.arc_degrees! * ARC_UNIT)));
      const total = types.reduce((s, t) => s + t.arc_degrees! * t.qty, 0);
      if (total > bestCurveDeg) {
        bestCurveDeg = total;
        bestCurveRadius = r;
      }
      const half = 180 * ARC_UNIT;
      const st = pairStates(
        types.map((t) => Math.round(t.arc_degrees! * ARC_UNIT)),
        types.map((t) => t.qty),
        half,
        maxStates,
      );
      const ends = st.get(half + "," + half);
      if (!ends) continue;

      const depth = 2 * r;
      if (depth > maxD) {
        tooBig = true;
        continue;
      }
      const capSide = Math.floor(Math.min(1e9, (maxW - 2 * r) * TENTH));
      if (capSide < 0) {
        tooBig = true;
        continue;
      }
      const sUnits = straights.map((t) => Math.round(t.length_mm * TENTH));
      const sQty = straights.map((t) => t.qty);
      const copies = sQty.reduce((x, y) => x + y, 0);
      const sideList =
        copies <= EXACT_LIMIT
          ? [...pairStates(sUnits, sQty, capSide, maxStates).values()]
          : symmetricStates(sUnits, sQty, capSide, tol);
      // Equal (within tol) sides, longest first.
      const ok = sideList.filter((s) => s.a - s.b <= tol);
      ok.sort((x, y) => y.b - x.b);
      const chosen: typeof ok = [];
      // Biggest, smallest non-zero, the circle, and one in between.
      if (ok.length) {
        const nonZero = ok.filter((s) => s.b > 0);
        const zero = ok.find((s) => s.b === 0 && s.a === 0);
        // Per curve size: the biggest oval, one about half its length,
        // and the plain circle.
        if (nonZero[0]) {
          chosen.push(nonZero[0]);
          const halfLen = nonZero[0].b / 2;
          const mid = nonZero.slice(1).reduce<(typeof ok)[number] | null>(
            (best, x) => (!best || Math.abs(x.b - halfLen) < Math.abs(best.b - halfLen) ? x : best),
            null,
          );
          if (mid && mid.b < nonZero[0].b * 0.8) chosen.push(mid);
        }
        if (zero) chosen.push(zero);
      }
      const seen = new Set<string>();
      for (const s of chosen) {
        const key = s.a + "/" + s.b;
        if (seen.has(key)) continue;
        seen.add(key);
        const sideA = expand(straights, s.pa);
        const sideB = expand(straights, s.pb);
        const end1 = expand(types, ends.pa);
        const end2 = expand(types, ends.pb);
        const sideMm = Math.max(s.a, s.b) / TENTH;
        const sequence = [...sideA, ...end1, ...sideB, ...end2];
        plans.push({
          shape: s.a === 0 ? "circle" : "oval",
          system_id: gk === "__own__" ? undefined : gk,
          radius_mm: types[0]!.radius_mm!,
          side_mm: sideMm,
          sequence,
          parts: countParts(sequence),
          width_mm: sideMm + 2 * types[0]!.radius_mm!,
          depth_mm: 2 * types[0]!.radius_mm!,
          total_pieces: sequence.length,
        });
      }
    }
  }

  plans.sort((a, b) => b.side_mm - a.side_mm || a.radius_mm - b.radius_mm);
  if (plans.length) return { plans: plans.slice(0, 8) };

  if (bestCurveDeg === 0) {
    return {
      plans: [],
      reason: "A loop needs sectional curves, and your list has none with a count above 0.",
      nearest:
        "Set how many curves you own in step 2. (Flex track bends to any curve, but Trackfit plans loops from sectional curves only.)",
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
    reason:
      "A loop needs a full circle of curves of one size (360 degrees, half at each end).",
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
  // Keep distinct labels apart (the user wants to know which box to open),
  // but cap the type count by merging identical geometry with identical label.
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

function countParts(seq: LoopUse[]): LoopUse[] {
  const m = new Map<string, LoopUse>();
  for (const u of seq) {
    const k = u.label + "|" + u.kind + "|" + u.length_mm + "|" + (u.radius_mm ?? "") + "|" + (u.arc_degrees ?? "");
    const prev = m.get(k);
    if (prev) prev.count++;
    else m.set(k, { ...u });
  }
  // Straights longest first, then curves: the order you would unpack them.
  return [...m.values()].sort(
    (a, b) =>
      (a.kind === "curve" ? 1 : 0) - (b.kind === "curve" ? 1 : 0) ||
      b.length_mm - a.length_mm ||
      a.label.localeCompare(b.label),
  );
}

export interface TracedSegment {
  kind: "straight" | "curve";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** For curves: the SVG arc radius and sweep. */
  r?: number;
  arc?: number;
  label: string;
}

/**
 * Lay the plan's pieces end to end, turning left on curves, and return each
 * piece's start and end point. The last end point equals the start point
 * when (and only when) the loop really closes.
 */
export function tracePlan(plan: LoopPlan): { segments: TracedSegment[]; end: { x: number; y: number; heading: number } } {
  let x = 0;
  let y = 0;
  let h = 0; // radians, 0 = +x
  const segments: TracedSegment[] = [];
  for (const p of plan.sequence) {
    if (p.kind === "straight") {
      const nx = x + p.length_mm * Math.cos(h);
      const ny = y + p.length_mm * Math.sin(h);
      segments.push({ kind: "straight", x0: x, y0: y, x1: nx, y1: ny, label: p.label });
      x = nx;
      y = ny;
    } else {
      const r = p.radius_mm!;
      const a = (p.arc_degrees! * Math.PI) / 180;
      // Left turn: centre is 90 degrees left of heading.
      const cx = x - r * Math.sin(h);
      const cy = y + r * Math.cos(h);
      const nh = h + a;
      const nx = cx + r * Math.sin(nh);
      const ny = cy - r * Math.cos(nh);
      segments.push({ kind: "curve", x0: x, y0: y, x1: nx, y1: ny, r, arc: p.arc_degrees, label: p.label });
      x = nx;
      y = ny;
      h = nh;
    }
  }
  return { segments, end: { x, y, heading: h } };
}
