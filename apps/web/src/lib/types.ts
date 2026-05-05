/**
 * App-local types. The solver and library packages own their own types;
 * these are the UI-facing shapes that get persisted to localStorage and
 * passed between components.
 */

import type { TrackKind } from "@trackfit/library";

export type Unit = "in" | "mm";

/**
 * Shape of the gap the user is trying to fill.
 *  - "straight" : single length only (v0.2 behavior; routes to findCombinations)
 *  - "curve"    : chord length + arc sweep (90/45/30/22.5°/custom)
 *  - "offset"   : chord length + sideways shift (S-curve, net angle 0)
 *
 * Persisted to localStorage v2; v1 saves are migrated to "straight".
 */
export type GapShape = "straight" | "curve" | "offset";

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
  /** curves only — radius along centerline, mm */
  radius_mm?: number;
  /** curves only — arc sweep, degrees */
  arc_degrees?: number;
  /** turnouts only — frog number e.g. "#4", "#6", "Y" */
  turnout_frog?: string | null;
  /** turnouts/crossings — overall length along main route, mm */
  overall_length_mm?: number | null;
  /** turnouts only — divergence angle in degrees (reserved for v2 pathing) */
  divergence_degrees?: number | null;
  /** manufacturer SKU when known (passed through from library JSON) */
  product_code?: string | null;
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
  /** v2: gap-shape picker — "straight" matches the v0.2 single-length flow */
  gap_shape?: GapShape;
  /** v2: curve gap arc sweep, degrees (only used when gap_shape === "curve") */
  gap_arc_degrees?: string;
  /** v2: lateral shift for an offset/S-curve gap, in user-display units */
  gap_offset?: string;
}
