import { listSystems, type Scale, type TrackSystem } from "@trackfit/library";
import type { InventoryRow } from "./types";

/**
 * Distinct track scales present in an inventory, derived from each row's
 * source system (system_id). Hand-typed rows carry no system_id and no
 * scale, so they're ignored — we only flag a mismatch we can prove from
 * library data, never from a guess about a typed label.
 *
 * Scales preserve first-seen order so the advisory message reads in the
 * order the user actually built their box.
 */
export function distinctScales(
  rows: InventoryRow[],
  systems: TrackSystem[] = listSystems(),
): Scale[] {
  const scaleById = new Map(systems.map((s) => [s.id, s.scale] as const));
  const scales = new Set<Scale>();
  for (const row of rows) {
    if (!row.system_id) continue;
    const scale = scaleById.get(row.system_id);
    if (scale) scales.add(scale);
  }
  return [...scales];
}

/**
 * True when the inventory mixes pieces from two or more different scales.
 * Different scales are different track gauges, so the pieces physically
 * cannot connect — the solver, which matches on geometry alone, would
 * otherwise happily suggest a combination that can't be assembled.
 *
 * Note: same-scale brand mixing (e.g. Atlas + Bachmann HO) is deliberately
 * NOT flagged — that's a supported workflow (focus-group P2-T2-F3).
 */
export function hasMixedScales(
  rows: InventoryRow[],
  systems: TrackSystem[] = listSystems(),
): boolean {
  return distinctScales(rows, systems).length >= 2;
}

/** Render a scale list for the advisory, e.g. ["N","HO","O"] -> "N, HO and O". */
export function formatScales(scales: Scale[]): string {
  if (scales.length <= 1) return scales.join("");
  return `${scales.slice(0, -1).join(", ")} and ${scales[scales.length - 1]}`;
}
