/**
 * App-local types. The solver and library packages own their own types;
 * these are the UI-facing shapes that get persisted to localStorage and
 * passed between components.
 */

import type { TrackKind } from "@trackfit/library";

export type Unit = "in" | "mm";

export interface InventoryRow {
  label: string;
  length_mm: number;
  qty: number;
  /** base64 data URL or null */
  photo: string | null;
  /**
   * Track kind, propagated from the library JSON when a preset is loaded.
   * Undefined for manually-added rows; consumers fall back to a label-based
   * heuristic when this is missing. Optional so persisted v0.2 state is
   * forward-compatible.
   */
  kind?: TrackKind;
  /** the solver's InventoryItem accepts arbitrary pass-through metadata */
  [extra: string]: unknown;
}

export interface PersistedState {
  unit: Unit;
  inventory: InventoryRow[];
  gapPhoto: string | null;
  /** kept as the raw input string the user typed, matches v0.2 behavior */
  target: string;
  tolerance: string;
}
