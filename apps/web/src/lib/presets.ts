import type { TrackPiece, TrackSystem } from "@trackfit/library";
import { DEFAULT_PRESET_QTY } from "./constants";
import type { InventoryRow, Unit } from "./types";

/**
 * Convert a library TrackSystem into the inventory shape the UI uses.
 *
 * As of v0.3 the UI shows every kind in the library — straights, fitters,
 * flex, curves, turnouts, and crossings. Curves carry their radius_mm and
 * arc_degrees so the curve solver and the InventoryRow renderer can use them
 * directly. Turnouts and crossings appear so the user sees the full contents
 * of their box; the solver doesn't search through them yet (TODO(turnouts)).
 *
 * Pieces with no usable size at all (no length_mm AND no radius/arc) are
 * dropped — that's a draft-data placeholder, not an inventory item.
 */

/** Round-trip the library piece into an inventory row. Pieces missing usable
 *  geometry are signalled by returning null so the caller can drop them. */
function pieceToRow(p: TrackPiece): InventoryRow | null {
  // For curves we prefer radius_mm × arc as the source of truth and derive
  // the arc length on render; for everything else length_mm is the unit.
  const hasLength =
    typeof p.length_mm === "number" && (p.length_mm as number) > 0;
  const hasCurve =
    typeof p.radius_mm === "number" &&
    typeof p.arc_degrees === "number" &&
    (p.radius_mm as number) > 0 &&
    (p.arc_degrees as number) > 0;

  // Turnouts/crossings often ship with `length_mm: null` because their
  // geometry is two-route; show them in the inventory anyway so the user
  // knows we know about them. They can't be solver inputs (yet).
  const isStructural = p.kind === "turnout" || p.kind === "crossing";

  if (!hasLength && !hasCurve && !isStructural) return null;

  const length_mm = hasLength
    ? (p.length_mm as number)
    : hasCurve
      ? // Derive the arc length so the curve solver gets a consistent
        // length_mm field; the docs/curve-solver-design.md formula is r·θ_rad.
        (p.radius_mm as number) *
        (p.arc_degrees as number) *
        (Math.PI / 180)
      : 0;

  const row: InventoryRow = {
    label: p.label,
    length_mm,
    qty: DEFAULT_PRESET_QTY,
    photo: null,
    kind: p.kind,
  };
  // Carry through the geometry-bearing fields when present so the solver and
  // the InventoryRow renderer can pick them up without re-reading JSON.
  if (hasCurve) {
    row.radius_mm = p.radius_mm as number;
    row.arc_degrees = p.arc_degrees as number;
  }
  if (p.turnout_frog) row.turnout_frog = p.turnout_frog;
  if (p.product_code) row.product_code = p.product_code;
  // Carry turnout / crossing geometry through so the curve solver's v1 turnout
  // pathing (treat as a straight of `overall_length_mm`) has the data it needs.
  // TODO(v2 turnout pathing): `divergence_degrees` is propagated now so the
  // future diverging-branch search has zero data plumbing left to do.
  if (typeof p.overall_length_mm === "number") {
    row.overall_length_mm = p.overall_length_mm;
  }
  if (typeof p.divergence_degrees === "number") {
    row.divergence_degrees = p.divergence_degrees;
  }
  return row;
}

export function presetToInventory(system: TrackSystem): InventoryRow[] {
  return system.pieces
    .map(pieceToRow)
    .filter((r): r is InventoryRow => r !== null);
}

export function presetUnit(system: TrackSystem): Unit {
  return system.default_unit === "mm" ? "mm" : "in";
}

/**
 * Heuristic: for a set of inventory pieces (typically the pieces in one
 * solver Solution), find which library system they most likely came from.
 *
 * Match strategy: count how many of each system's piece labels appear in
 * the inventory. Highest match count wins. Ties resolve by the system that
 * appears first in SYSTEM_DISPLAY_ORDER (passed in as `systems`). Returns
 * undefined when nothing matches at all.
 *
 * Used by the SUGGESTED callout's "Where to buy" panel to seed the
 * marketplace search with a manufacturer hint (e.g. "Märklin"), which
 * sharpens the vendor query and unlocks Reynaulds for European systems.
 */
export function inferSystemForRows(
  rows: { label: string }[],
  systems: TrackSystem[],
): TrackSystem | undefined {
  if (rows.length === 0 || systems.length === 0) return undefined;
  const labelSet = new Set(rows.map((r) => r.label));
  let best: { system: TrackSystem; score: number } | undefined;
  for (const sys of systems) {
    let score = 0;
    for (const piece of sys.pieces) {
      if (labelSet.has(piece.label)) score += 1;
    }
    if (score === 0) continue;
    if (!best || score > best.score) best = { system: sys, score };
  }
  return best?.system;
}

/**
 * v0.2 behavior: when the app reloads from localStorage, see if the saved
 * inventory matches a known preset's piece signature so the chip can be
 * highlighted. Signature ignores order, photos, labels — only piece lengths
 * and quantities.
 */
export function matchPresetId(
  inventory: InventoryRow[],
  systems: TrackSystem[],
): string | null {
  const sig = inventory
    .map((p) => `${p.length_mm.toFixed(3)}x${p.qty}`)
    .sort()
    .join("|");
  const match = systems.find((sys) => {
    const psig = presetToInventory(sys)
      .map((p) => `${p.length_mm.toFixed(3)}x${p.qty}`)
      .sort()
      .join("|");
    return psig === sig;
  });
  return match ? match.id : null;
}
