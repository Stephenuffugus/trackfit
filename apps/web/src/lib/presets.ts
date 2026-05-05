import type { TrackPiece, TrackSystem } from "@trackfit/library";
import { DEFAULT_PRESET_QTY } from "./constants";
import type { InventoryRow, Unit } from "./types";

/**
 * Convert a library TrackSystem into the v0.2-style inventory the UI uses.
 *
 * The 1D solver only understands straights, fitters, and flex (anything with
 * a single length_mm). Curves and turnouts are skipped here — they are part
 * of the Track 2 curve-solver work, not v0.2 parity.
 */
const SUPPORTED_KINDS = new Set<TrackPiece["kind"]>([
  "straight",
  "fitter",
  "flex",
]);

export function presetToInventory(system: TrackSystem): InventoryRow[] {
  return system.pieces
    .filter(
      (p) =>
        SUPPORTED_KINDS.has(p.kind) &&
        typeof p.length_mm === "number" &&
        p.length_mm > 0,
    )
    .map((p) => ({
      label: p.label,
      length_mm: p.length_mm as number,
      qty: DEFAULT_PRESET_QTY,
      photo: null,
    }));
}

export function presetUnit(system: TrackSystem): Unit {
  return system.default_unit === "mm" ? "mm" : "in";
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
