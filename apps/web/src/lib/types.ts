/**
 * App-local types. The solver and library packages own their own types;
 * these are the UI-facing shapes that get persisted to localStorage and
 * passed between components.
 */

export type Unit = "in" | "mm";

export interface InventoryRow {
  label: string;
  length_mm: number;
  qty: number;
  /** base64 data URL or null */
  photo: string | null;
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
