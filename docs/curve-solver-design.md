# Curve-Aware Track Gap Solver — Design

Status: design draft for `packages/solver/` (Phase 2, Track 2). Audience: hobbyist (math) + engineer (pseudocode).

The v0.2 solver answers 1D: *which combination of pieces sums to a target length?* — bounded subset-sum, handled by `findCombinations()` in `trackfit-1.html` (≈ lines 580–660). Real-world gaps are rarely straight: corners need angular change, wyes need lateral offset, S-curves both with sign reversals. This document specifies a 2D-with-rotation gap fitter consuming the same `TrackPiece[]` inventory plus a 3-axis target, preserving v0.2's killer feature — the precise *near-miss* suggestion.

---

## 1. Problem statement

**Inputs:**
```
target    = { length_mm, lateral_offset_mm (signed: left +, right −),
              angle_degrees (signed) }
inventory = TrackPiece[]              // straights, fitters, curves; per-piece qty
tolerance = { length_mm,    // typ. 2–5
              lateral_mm,   // typ. 2–5
              angle_degrees // typ. 1–2°
            }
```
`TrackPiece` is the shape settled in `packages/library/SCHEMA.md`. Turnouts/crossings are out of scope.

**Outputs:**
```
{ solutions:  RankedCombo[],    // exact fits within all 3 tolerances, best-first
  bestUnder:  RankedCombo|null, // best near-miss (undershoot)
  bestOver:   RankedCombo|null, // best near-miss (overshoot)
  suggestion: MissingPiece|null // single piece that would close the residual
}
```
A `RankedCombo` carries the **ordered** piece sequence, the endpoint pose `{x, y, heading}`, and per-axis residuals. Order matters with curves: `straight → curve` ≠ `curve → straight`. v0.2 returned multisets because order is invisible in 1D; here it is part of the answer.

---

## 2. Geometry primitives

Each piece has an entry pose and an exit pose. Chain them: entry pose of piece *n+1* = exit pose of piece *n*.

**2.1 Straight of length L.** `entry ─── L ───► exit`. Path length `L`; exit in entry-local frame `(L, 0)`; heading change `0°`.

**2.2 Curve of radius `r`, arc `θ` degrees, turning left.**

```
                     ╭──── exit (tangent rotated +θ)
              arc  ╱
                ╱  )  θ
              ╱     )
  entry ──┴─────────┴── (centre at (0, +r) in entry-local frame)
```

Let `θ_rad = θ · π / 180`.
- **Arc length** (path the train rolls): `2π · r · θ / 360 = r · θ_rad`
- **Chord** (straight-line entry-to-exit, all v0.2 knew): `2 · r · sin(θ_rad / 2)`
- **Lateral offset** of exit vs. entry tangent: `r · (1 − cos(θ_rad))`
- **Longitudinal advance** along entry tangent: `r · sin(θ_rad)`
- **Heading change**: `θ` (positive left, negative right)

Exit pose in entry-local frame, left turn: `exit_x = r·sin(θ_rad)`, `exit_y = r·(1−cos(θ_rad))`, `exit_h = +θ`. Right turn: negate `exit_y` and `exit_h`.

**Sanity check:** at `θ = 90°`, `sin(90°)=1`, `cos(90°)=0`, so exit = `(r, r)` — `r` mm forward, `r` mm sideways, a right angle. A quarter-circle of HO 22-in radius (558.8 mm) lands you 558.8 mm forward and 558.8 mm sideways.

### 2.3 Fitters and flex

Fitters are short straights. Flex track is **not** a search input — it surfaces as a 1:1 cut template (Track 6) or as the missing-piece suggestion (§5).

### 2.4 Sign convention

Curve geometry is intrinsic (radius + arc); direction is a placement choice. The solver tries both `+θ` and `−θ` for each curve, doubling the curve branching factor. Enables S-curves and reverse loops. Stored `arc_degrees` is always positive.

### 2.5 Pose composition

Given pose `(x, y, h)` and local exit `(dx, dy, dh)`, the new pose is:

```
h_rad = h · π / 180
new_x = x + dx · cos(h_rad) − dy · sin(h_rad)
new_y = y + dx · sin(h_rad) + dy · cos(h_rad)
new_h = h + dh
```

Standard 2D rigid-body composition. Wrap `h` into `(−180°, +180°]` only at comparison time, so the angular-sum bound (§4) can detect spirals.

---

## 3. Combination evaluation

A *combination* is an ordered sequence of `(piece, direction)` pairs (`direction ∈ {+1, −1}` for curves, fixed `+1` for straights). Walk the sequence: start at `(0, 0, 0)`; for each step compute local exit (§2.2 with sign) and compose (§2.5); compare final pose to target.

**Per-axis residuals:**

```
r_long  = endpoint.x − target.length_mm
r_lat   = endpoint.y − target.lateral_offset_mm
r_angle = wrap(endpoint.h − target.angle_degrees)
```

**Score** (tolerance-normalized Euclidean distance):
```
score = sqrt( (r_long /tol.length_mm)² + (r_lat /tol.lateral_mm)² + (r_angle /tol.angle_deg)² )
```
A combination is a **solution** iff each `|residual|` is within its tolerance. Rank by `score`, then by piece count (fewer wins ties — same as v0.2).

---

## 4. Search strategy

Naïve enumeration of 20 types × 30 qty is astronomical. Tame it the v0.2 way: bounded recursion with pruning, but on three axes.

**4.1 Hard bounds.**
- Max cumulative path length: `target.length_mm × 1.5 + tol.length_mm`. Longer combos snake; users reject by eye.
- Max cumulative `|angle|`: `720°` — admits S-curves and reverse loops, rejects pathological windings. Configurable for helices.
- Max piece count: `20`. Past this, unbuildable.

**4.2 Per-recursion pruning.** At each node, given partial pose `(x, y, h)` and remaining inventory:
- Length: partial length already exceeds bound → return.
- Longitudinal: `target.length − x > Σ chord_remaining + tol.length` → return.
- Angular: `|target.angle − h| > Σ arc_remaining + tol.angle` → return.
- Lateral: symmetric, bounding by `Σ 2·r_i` over remaining curves (a radius-`r` curve displaces at most `2r` laterally).

**4.3 Ordering.** Sort inventory by descending path length, largest first — mirrors v0.2; overshoot prunes faster. Generate canonical (lexicographic) orderings within a multiset.

**4.4 Complexity and target.** Worst case `O(Π(qty_i + 1) · 2^curves · permutations)`; bounds collapse the reachable subtree in practice. Target: ≤ 200 ms for ≤ 20 types × ≤ 30 qty on a 2-yr-old laptop (≈ 2024 M-series MacBook Air or equivalent x86). If profiling exceeds: tighten angular sum (most layouts ≤ 360°); cap piece count at 12 (most fills ≤ 8); memoize partial poses on a tolerance grid. Keep the solver synchronous and pure — no worker thread until measurement demands it.

---

## 5. Near-miss suggestion (the killer feature)

When `solutions` is empty, v0.2's contract is: tell the user *exactly* what single piece would close the gap. Preserve and extend to 2D.

**5.1 Best-residual combo.** Across all combos evaluated (including pruned leaves), keep smallest `score` — `bestNear`.

**5.2 Plain-English residual.**
> *"With 2 × 9-inch straights and 1 × 22-inch radius / 30° curve, you'd be **8 mm short**, **3 mm to the left**, **2° under-rotated**."*
Numbers are `r_long`, `r_lat`, `r_angle`. Result-card body when no exact fit exists.

**5.3 Straight-dominated (v0.2 parity).** If `|r_lat|` and `|r_angle|` are within tolerance but `|r_long|` is not:
> *"Add a straight piece of length **`r_long` mm** (≈ `r_long / 25.4` in) to close the gap exactly."*
Match v0.2 bit-for-bit when target lateral and angle are zero (§6.6).

**5.4 Curve-dominated.** Residual dominantly angular (lateral and angle out, length close):
> *"A single curve of radius **R** mm and arc **θ°** would close it, where R = `r_lat / (1 − cos(r_angle))` and θ = `r_angle`."*
Round R to 1 mm, θ to 1°. If R falls below NMRA RP-11 minimum (§9), append: *"This is tighter than NMRA RP-11 recommends for [scale]; consider revising the layout."*

**5.5 Mixed residual.** If all three axes are out, do **not** invent a piece. Surface §5.2 plus the top three combos: "no single piece fixes this; here are your closest tries."

---

## 6. Acceptance test fixtures

These are contracts the implementation must satisfy. Place them in `packages/solver/__tests__/curves.fixtures.ts`.

**6.1 Pure-straight gap (v0.2 regression).** Inventory: the v0.2 Atlas HO Code 83 preset (lines 553–562 of `trackfit-1.html`):
```
[ {19.05, qty 2}, {25.4, qty 2}, {31.75, qty 2}, {38.1, qty 2},
  {50.8, qty 2}, {63.5, qty 2}, {152.4, qty 4}, {228.6, qty 4} ]
target    = { length_mm: 381.0, lateral_offset_mm: 0, angle_degrees: 0 }
tolerance = { length_mm: 2, lateral_mm: 2, angle_deg: 1 }
```
Expected: solution `[228.6 + 152.4] = 381.0`. Output equals v0.2's `findCombinations(items, 381, 2)` modulo pose fields. **Regression gate.**

**6.2 90° corner with two HO 22-in curves.**
```
inventory = [ { radius_mm: 558.8, arc_degrees: 30, qty: 12 },
              { length_mm: 228.6, qty: 4 } ]
target    = { length_mm: 558.8, lateral_offset_mm: 558.8, angle_degrees: 90 }
tolerance = { length_mm: 3, lateral_mm: 3, angle_deg: 1 }
```
Expected: 3 × curve (3×30°=90°), no straights. Endpoint `(558.8, 558.8, 90°)`. Score = 0.

**6.3 S-curve gap.**
```
inventory = [ { length_mm: 228.6, qty: 4 },
              { radius_mm: 558.8, arc_degrees: 30, qty: 12 } ]
target    = { length_mm: 750.0, lateral_offset_mm: 150.0, angle_degrees: 0 }
tolerance = { length_mm: 5, lateral_mm: 5, angle_deg: 1 }
```
Expected: at least one solution shaped `[straight, curve(+30°), curve(−30°), straight]` (or mirror). Net angle 0, net lateral ≈ 150 mm. Tests bidirectional placement (§2.4).

**6.4 Reverse-loop closure.**
```
inventory = [{ radius_mm: 558.8, arc_degrees: 30, qty: 12 }]
target    = { length_mm: 0, lateral_offset_mm: 1117.6, angle_degrees: 180 }
tolerance = { length_mm: 5, lateral_mm: 5, angle_deg: 1 }
```
Expected: 6 × curve (6×30°=180°), endpoint `(0, 2r, 180°) = (0, 1117.6, 180°)`. Tests angular-sum bound to 180°.

**6.5 No-solution case.**
```
inventory = [{ length_mm: 228.6, qty: 4 }]
target    = { length_mm: 600, lateral_offset_mm: 200, angle_degrees: 45 }
tolerance = { length_mm: 2, lateral_mm: 2, angle_deg: 1 }
```
Expected: `solutions = []`; `bestNear` is the closest straight-only combo; `suggestion` describes angular + lateral residuals — **not** a single straight (§5.5 forbids inventing a piece for mixed residuals).

**6.6 Near-miss case (v0.2 string parity).** Inventory as 6.1; `target = { length_mm: 386.0, lateral: 0, angle: 0 }`; same tolerance. Expected: `solutions = []`; `bestUnder = [228.6 + 152.4] = 381`; `suggestion = "add a 5 mm straight"` — bit-for-bit the v0.2 string.

---

## 7. Out of scope

Per `CLAUDE_CODE_HANDOFF.md` §8, this solver does **not** model:

- **Easements / clothoid spirals.** Real prototypes use transition curves; sectional-track hobbyists accept the curvature step. Phase 3.
- **Superelevation** (banking the outside rail). Same rationale.
- **Vertical grade / helix pitch.** Strictly 2D in the layout plane.
- **Turnouts and crossings.** Richer geometry (two exit poses); feature-flag once the basic solver ships.
- **Flex track as a search input.** Surfaces as a 1:1 cut template instead.

When a target is impossible in circular-arc-only terms, the solver says so plainly rather than faking it.

---

## 8. Reference TS pseudocode

Shape, not production. Adapt to `packages/solver/` types; add tests *first*. Reachability prunes (§4.2) are omitted as optimization; add after baseline tests pass.

```ts
type Straight = { kind: "straight"; id: string; length_mm: number; qty: number };
type Curve    = { kind: "curve"; id: string; radius_mm: number; arc_degrees: number; qty: number };
type Piece    = Straight | Curve;
type Pose     = { x: number; y: number; h: number };  // h in degrees
type Step     = { piece: Piece; dir: 1 | -1 };
type Combo    = { steps: Step[]; endpoint: Pose; pathLength_mm: number };

const MAX_ANGLE_SUM = 720;
const PIECE_COUNT_CAP = 20;

function localExit(p: Piece, dir: 1 | -1): Pose {
  if (p.kind === "straight") return { x: p.length_mm, y: 0, h: 0 };
  const t = (p.arc_degrees * Math.PI) / 180;
  return {
    x: p.radius_mm * Math.sin(t),
    y: dir * p.radius_mm * (1 - Math.cos(t)),
    h: dir * p.arc_degrees,
  };
}

function compose(a: Pose, b: Pose): Pose {
  const r = (a.h * Math.PI) / 180;
  return {
    x: a.x + b.x * Math.cos(r) - b.y * Math.sin(r),
    y: a.y + b.x * Math.sin(r) + b.y * Math.cos(r),
    h: a.h + b.h,
  };
}

function pathLen(p: Piece): number {
  return p.kind === "straight"
    ? p.length_mm
    : (2 * Math.PI * p.radius_mm * p.arc_degrees) / 360;
}

export function solve(inv: Piece[], target: Target, tol: Tol)
  : { solutions: Combo[]; bestNear: Combo | null }
{
  const sorted = [...inv].sort((a, b) => pathLen(b) - pathLen(a));
  const lengthBound = target.length_mm * 1.5 + tol.length_mm;
  const remaining = sorted.map(p => p.qty);
  const solutions: Combo[] = [];
  let bestNear: Combo | null = null;
  const stack: Step[] = [];

  function visit(pose: Pose, pathLength: number, angleSum: number) {
    if (pathLength > lengthBound) return;
    if (angleSum  > MAX_ANGLE_SUM)    return;
    if (stack.length > PIECE_COUNT_CAP) return;

    const rL = pose.x - target.length_mm;
    const rY = pose.y - target.lateral_offset_mm;
    const rA = wrap(pose.h - target.angle_degrees);
    const combo: Combo = { steps: [...stack], endpoint: pose, pathLength_mm: pathLength };
    if (Math.abs(rL) <= tol.length_mm
     && Math.abs(rY) <= tol.lateral_mm
     && Math.abs(rA) <= tol.angle_deg) solutions.push(combo);
    if (!bestNear || scoreOf(combo, target, tol) < scoreOf(bestNear, target, tol))
      bestNear = combo;

    for (let i = 0; i < sorted.length; i++) {
      if (remaining[i] === 0) continue;
      const piece = sorted[i];
      const dirs: (1|-1)[] = piece.kind === "curve" ? [1, -1] : [1];
      for (const d of dirs) {
        const next = compose(pose, localExit(piece, d));
        const nLen = pathLength + pathLen(piece);
        const nAng = angleSum + (piece.kind === "curve" ? piece.arc_degrees : 0);
        remaining[i]--; stack.push({ piece, dir: d });
        visit(next, nLen, nAng);
        stack.pop(); remaining[i]++;
      }
    }
  }

  visit({ x: 0, y: 0, h: 0 }, 0, 0);
  solutions.sort((a, b) => scoreOf(a, target, tol) - scoreOf(b, target, tol)
                        || a.steps.length - b.steps.length);
  return { solutions: solutions.slice(0, 20), bestNear };
}
```

`wrap(deg)` reduces an angle into `(−180°, +180°]`. `scoreOf()` is the §3 weighted-Euclidean score.

---

## 9. NMRA references

**RP-11 — Curvature and Rolling Stock.** Minimum-radius guidance per scale in three tiers: *Conventional* (runs reliably), *Wide* (longer locos), *Broad* (prototype-faithful). Approximate values widely cited in the hobby press:

| Scale | Conventional   | Wide           | Broad            |
|-------|----------------|----------------|------------------|
| Z     | 195 mm         | 250 mm         | 490 mm           |
| N     | 228 mm         | 318 mm         | 645 mm           |
| HO    | 457 mm (18 in) | 610 mm (24 in) | 1067 mm (42 in)  |
| OO    | 438 mm         | 610 mm         | 1067 mm          |
| S     | 762 mm (30 in) | 914 mm (36 in) | 1524 mm (60 in)  |
| O     | 1067 mm (42 in)| 1219 mm (48 in)| 1829 mm (72 in)  |

Re-verify against the current RP-11 PDF before shipping. Track 1 should pull it into `packages/library/data/nmra-rp11.json` with `source_verified_at`.

**S-8 — Track Centers.** Parallel-track spacing minima. Warn if a large `lateral_offset_mm` implies a parallel run violating S-8.

**Where RP-11 constrains the UI:** (1) gray out / warn on curve radii below *Conventional* for the declared scale; hard-block below 80 % of *Conventional* with an override. (2) The §5.4 single-curve suggestion checks R against RP-11 and appends the warning if too tight. (3) Phase-3 LLM assistant is system-prompted with per-scale minima.

**URLs to verify** (NMRA paths reorganize; web access was disabled when this was written):
- `https://www.nmra.org/index-standards-and-recommended-practices`
- `https://www.nmra.org/sites/default/files/standards/sandrp/pdf/rp-11.pdf`
- `https://www.nmra.org/sites/default/files/standards/sandrp/pdf/s-8.pdf`

Re-verify and pin the canonical PDFs (or vendor the tables as JSON) before any RP-11-derived guidance ships.

---

## 10. Open questions

1. **Order canonicalization.** How aggressively to dedupe reorderings of the same multiset? Naïve dedup loses the S-curve / reverse-curve distinction. Probably: dedupe by *piece multiset + signed-direction multiset*.
2. **Heading wrap.** For reverse loops, `+180°` and `−180°` are equal. Document in `wrap()`; add a fixture.
3. **Score weighting.** Are per-axis tolerances equally important, or should length dominate? Ask the friend at week-1 demo.
4. **UI for ordered output.** v0.2 shows multisets; curves need order. Likely an SVG mini-diagram — UI work, not solver work.

— end of design —
