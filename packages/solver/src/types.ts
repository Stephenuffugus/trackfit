/**
 * Core types for the Trackfit solver.
 *
 * The 1D subset-sum solver only needs `length_mm` and `qty` from each
 * inventory item. Extra fields are passed through opaquely so the UI can
 * keep its photo / label / kind / radius metadata attached to each piece in
 * the returned solutions.
 */

export interface InventoryItem {
  /** display label, used for grouping and rendering */
  label: string;
  /** millimeters; the only unit stored internally */
  length_mm: number;
  /** how many of this piece the user owns */
  qty: number;
  /** allow extra UI metadata to ride along */
  [extra: string]: unknown;
}

export interface SolutionPiece extends InventoryItem {
  /** how many of this piece the solver chose for this combination */
  count: number;
}

export interface Solution {
  pieces: SolutionPiece[];
  /** sum of length_mm * count across all pieces */
  total_mm: number;
  /** |total_mm - target_mm| */
  deviation_mm: number;
  /** sum of counts; convenience */
  pieceCount: number;
}

export interface SolverResult {
  /** combinations within ±tolerance, sorted best-first by deviation then piece-count */
  solutions: Solution[];
  /** largest total still UNDER target (the basis for the "missing piece" near-miss suggestion) */
  bestUnder: Solution | null;
  /** smallest total that overshoots target+tolerance */
  bestOver: Solution | null;
}
