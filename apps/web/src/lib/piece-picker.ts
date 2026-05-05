/**
 * Piece-picker logic. Pure helpers shared between the PiecePicker UI
 * component and the InventoryList wiring; kept module-level (not
 * inside the component) so the dedupe-and-bump behavior is unit
 * testable without spinning up React.
 *
 * Design notes:
 *   - `buildPickerSections` shapes a list of TrackSystems into the
 *     grouped, kind-ordered, search-filtered structure the UI renders.
 *     For a single active preset we emit one section per kind. With
 *     no active preset we emit one section per (system, kind).
 *   - `pieceToInventoryRow` mirrors the field set `presetToInventory`
 *     produces for a single piece, so the picker lands a row that's
 *     indistinguishable from a preset-loaded one (same kind / radius
 *     / arc / overall_length / product_code / divergence). This keeps
 *     the curve solver, the InventoryRow renderer, and the dedupe
 *     signature stable.
 *   - `findInventoryDuplicate` and `addOrBump` implement the "if the
 *     same piece type already exists in your inventory, bump qty by
 *     1 instead of duplicating the row" rule from the user feedback.
 *     Identity is geometric, not label-based — two rows with the same
 *     length / radius / arc / overall_length / kind are the same
 *     piece even if the user renamed one of them.
 */
import type { TrackPiece, TrackSystem } from "@trackfit/library";
import { DEFAULT_PRESET_QTY, IN_TO_MM } from "./constants";
import type { InventoryRow } from "./types";

/** Display order across the inventory: the older user reads top-to-bottom. */
export const KIND_ORDER: ReadonlyArray<{
  kind: PieceGroupKind;
  label: string;
}> = [
  { kind: "straight", label: "Straights" },
  { kind: "curve", label: "Curves" },
  { kind: "turnout", label: "Turnouts" },
  { kind: "crossing", label: "Crossings" },
  { kind: "other", label: "Other" },
];

/**
 * Collapse the library's many TrackKind values into the five buckets
 * the inventory groups by. Fitters / flex / rerailers / bumpers /
 * uncouplers / transitions all roll up under "Other" because that's
 * how an older hobbyist categorises them — not by sub-type, just by
 * "isn't curved or branching". Manually-added rows (kind === undefined)
 * roll up under "Straights" since that's the default the manual-entry
 * path produces.
 */
export type PieceGroupKind =
  | "straight"
  | "curve"
  | "turnout"
  | "crossing"
  | "other";

export function groupKindOf(
  kind: InventoryRow["kind"] | undefined,
): PieceGroupKind {
  if (kind === "curve") return "curve";
  if (kind === "turnout") return "turnout";
  if (kind === "crossing") return "crossing";
  if (kind === "straight" || kind === undefined) return "straight";
  return "other";
}

/** A single picker entry — the user-facing shape. */
export interface PickerItem {
  /** Stable key for React; combines system id + piece id. */
  key: string;
  /** Display label, e.g. "10 in straight". */
  label: string;
  /** Plain-English key dimension line, e.g. "9 in" / "22 in radius · 30°" / "#4 turnout". */
  dimension: string;
  /** Manufacturer SKU when known. */
  product_code: string | null;
  /** The full preset row this picker entry will produce when picked. */
  row: InventoryRow;
  /**
   * If this piece type is already in the user's inventory, the
   * current qty there. Lets the picker render an "(in inventory: 4)"
   * chip and lets the caller bump qty instead of pushing a duplicate.
   */
  existingQty?: number;
}

/**
 * One section of the picker — either one kind under one system, or
 * (in the no-active-preset case) one kind under one of N systems. The
 * UI renders these as collapsible-ish blocks; actual collapse state
 * lives in the component.
 */
export interface PickerSection {
  /** Stable key for the section. */
  key: string;
  /** Sub-heading, e.g. "Straights" or "Atlas HO Code 83 — Curves". */
  heading: string;
  /** Optional mini-heading for the system, used when sections come from many systems. */
  systemName?: string;
  kindLabel: string;
  items: PickerItem[];
}

/**
 * Build picker sections from the supplied systems. When `activeSystem`
 * is provided, only that system's pieces are surfaced (one section per
 * kind). Otherwise every system contributes (one section per
 * system+kind, ordered by SYSTEM_DISPLAY_ORDER then kind).
 *
 * `inventory` is consulted only to compute `existingQty` on each item;
 * it never filters the picker — the user still sees pieces they
 * already own (so they can bump qty by clicking).
 *
 * `query` is a case-insensitive substring filter over label, product
 * code, and dimension. Empty string passes everything.
 */
export function buildPickerSections(opts: {
  activeSystem: TrackSystem | null;
  allSystems: TrackSystem[];
  inventory: InventoryRow[];
  query: string;
}): PickerSection[] {
  const { activeSystem, allSystems, inventory, query } = opts;
  const q = query.trim().toLowerCase();

  // Index inventory by signature for O(1) "do I already own this?" lookups.
  const ownedBySig = new Map<string, number>();
  for (const r of inventory) {
    const sig = inventoryRowSignature(r);
    ownedBySig.set(sig, (ownedBySig.get(sig) ?? 0) + r.qty);
  }

  const systems = activeSystem ? [activeSystem] : allSystems;
  const sections: PickerSection[] = [];

  for (const sys of systems) {
    const buckets: Record<PieceGroupKind, PickerItem[]> = {
      straight: [],
      curve: [],
      turnout: [],
      crossing: [],
      other: [],
    };

    for (const piece of sys.pieces) {
      const row = pieceToInventoryRow(piece, sys);
      if (!row) continue;
      const item: PickerItem = {
        key: `${sys.id}::${piece.id}`,
        label: piece.label,
        dimension: dimensionLine(piece, sys),
        product_code: piece.product_code,
        row,
      };
      const sig = inventoryRowSignature(row);
      const ownedQty = ownedBySig.get(sig);
      if (ownedQty !== undefined) item.existingQty = ownedQty;

      // Filter on label / product code / dimension — covers "10 in",
      // "22r", "#4", "6-12014", or just "straight".
      if (q) {
        const hay =
          `${item.label} ${item.dimension} ${item.product_code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      buckets[groupKindOf(piece.kind)].push(item);
    }

    for (const { kind, label } of KIND_ORDER) {
      const items = buckets[kind];
      if (items.length === 0) continue;
      const showSystemPrefix = !activeSystem;
      sections.push({
        key: `${sys.id}::${kind}`,
        heading: showSystemPrefix ? `${sys.name} — ${label}` : label,
        systemName: showSystemPrefix ? sys.name : undefined,
        kindLabel: label,
        items,
      });
    }
  }

  return sections;
}

/**
 * Match `presetToInventory`'s field-mapping for a single piece. We
 * deliberately don't import that function — it operates on whole
 * systems and skips structural pieces with no usable size. This
 * single-piece variant returns null on the same conditions but
 * keeps each picker entry independent.
 */
export function pieceToInventoryRow(
  p: TrackPiece,
  _system: TrackSystem,
): InventoryRow | null {
  const hasLength =
    typeof p.length_mm === "number" && (p.length_mm as number) > 0;
  const hasCurve =
    typeof p.radius_mm === "number" &&
    typeof p.arc_degrees === "number" &&
    (p.radius_mm as number) > 0 &&
    (p.arc_degrees as number) > 0;
  const isStructural = p.kind === "turnout" || p.kind === "crossing";

  if (!hasLength && !hasCurve && !isStructural) return null;

  const length_mm = hasLength
    ? (p.length_mm as number)
    : hasCurve
      ? (p.radius_mm as number) *
        (p.arc_degrees as number) *
        (Math.PI / 180)
      : 0;

  // Default qty per piece — match the preset loader so the picker and
  // preset paths land an inventory row in the same shape. Treat 0 as
  // 1 defensively (per spec) so a future change to DEFAULT_PRESET_QTY
  // can't silently produce zero-qty rows.
  const baseQty = DEFAULT_PRESET_QTY > 0 ? DEFAULT_PRESET_QTY : 1;

  const row: InventoryRow = {
    label: p.label,
    length_mm,
    qty: baseQty,
    photo: null,
    kind: p.kind,
  };
  if (hasCurve) {
    row.radius_mm = p.radius_mm as number;
    row.arc_degrees = p.arc_degrees as number;
  }
  if (p.turnout_frog) row.turnout_frog = p.turnout_frog;
  if (p.product_code) row.product_code = p.product_code;
  if (typeof p.overall_length_mm === "number") {
    row.overall_length_mm = p.overall_length_mm;
  }
  if (typeof p.divergence_degrees === "number") {
    row.divergence_degrees = p.divergence_degrees;
  }
  return row;
}

/**
 * Plain-English dimension line for the picker. "9 in" / "22 in radius · 30°"
 * / "#4 turnout" / "crossing". Honors the system's default unit so
 * imperial systems don't show 228.6 mm to a user thinking in inches.
 */
function dimensionLine(p: TrackPiece, system: TrackSystem): string {
  const useIn = system.default_unit === "in";
  if (p.kind === "curve" && p.radius_mm && p.arc_degrees) {
    if (useIn) {
      const rIn = (p.radius_mm / IN_TO_MM).toFixed(
        Number.isInteger(p.radius_mm / IN_TO_MM) ? 0 : 2,
      );
      return `${stripTrailingZeros(rIn)} in radius · ${p.arc_degrees}°`;
    }
    return `${Math.round(p.radius_mm)} mm radius · ${p.arc_degrees}°`;
  }
  if (p.kind === "turnout") {
    return p.turnout_frog ? `${p.turnout_frog} turnout` : "turnout";
  }
  if (p.kind === "crossing") {
    return "crossing";
  }
  if (typeof p.length_mm === "number" && p.length_mm > 0) {
    if (useIn) {
      const inches = (p.length_mm / IN_TO_MM).toFixed(3);
      return `${stripTrailingZeros(inches)} in`;
    }
    return `${Math.round(p.length_mm)} mm`;
  }
  return "";
}

function stripTrailingZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

/**
 * Geometric signature for an inventory row, used to detect
 * "user already owns this piece type" when adding from the picker.
 * Identity is by kind + length + curve geometry + structural overall
 * length — NOT by label (so a renamed row still dedupes) and NOT by
 * product_code (manufacturers re-use SKUs across regions; geometry
 * is the safer key).
 */
export function inventoryRowSignature(row: InventoryRow): string {
  const kind = row.kind ?? "manual";
  const length = (row.length_mm ?? 0).toFixed(3);
  const radius =
    typeof row.radius_mm === "number" ? row.radius_mm.toFixed(3) : "";
  const arc =
    typeof row.arc_degrees === "number" ? row.arc_degrees.toFixed(2) : "";
  const overall =
    typeof row.overall_length_mm === "number"
      ? row.overall_length_mm.toFixed(3)
      : "";
  const frog = row.turnout_frog ?? "";
  return `${kind}|${length}|${radius}|${arc}|${overall}|${frog}`;
}

/**
 * Find the first inventory row matching `incoming`'s geometric
 * signature. Returns the index, or -1 if not found.
 */
export function findInventoryDuplicate(
  inventory: InventoryRow[],
  incoming: InventoryRow,
): number {
  const sig = inventoryRowSignature(incoming);
  for (let i = 0; i < inventory.length; i++) {
    const r = inventory[i];
    if (!r) continue;
    if (inventoryRowSignature(r) === sig) return i;
  }
  return -1;
}

/**
 * Resolve "user picked a piece in the PiecePicker" against the
 * existing inventory. If the same piece type already exists, bump
 * its qty by 1; otherwise append the new row. Returns the next
 * inventory plus the index of the affected row (so the caller can
 * scroll to it).
 */
export function addOrBump(
  inventory: InventoryRow[],
  incoming: InventoryRow,
): { next: InventoryRow[]; affectedIndex: number; bumped: boolean } {
  const dupIdx = findInventoryDuplicate(inventory, incoming);
  if (dupIdx >= 0) {
    const existing = inventory[dupIdx]!;
    const next = inventory.slice();
    next[dupIdx] = { ...existing, qty: (existing.qty ?? 0) + 1 };
    return { next, affectedIndex: dupIdx, bumped: true };
  }
  // Defensive: if DEFAULT_PRESET_QTY ever lands at 0, treat as 1.
  const safe: InventoryRow =
    incoming.qty > 0 ? incoming : { ...incoming, qty: 1 };
  return {
    next: [...inventory, safe],
    affectedIndex: inventory.length,
    bumped: false,
  };
}
