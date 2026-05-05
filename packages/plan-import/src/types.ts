/**
 * Plan-import types. Pure data — no DOM, no fetching.
 *
 * The input shape is "best-effort against AnyRail's documented XML export"
 * — see docs/plan-import-notes.md for the full provenance trail.
 */

export interface PlanRequirement {
  /** Library system the plan refers to (or "unknown" for unrecognised). */
  system_id: string;
  /** Manufacturer's product code, e.g. "S-9" or "44513". */
  product_code: string;
  /** Total count of this piece in the plan. */
  count: number;
}

export interface ParsePlanResult {
  /** Plan display name from the XML, or null. */
  name: string | null;
  /** Source format. v1 only emits "anyrail"; SCARM / XTrkCAD / JMRI later. */
  format: "anyrail";
  /** Piece-by-piece requirements. */
  requirements: PlanRequirement[];
  /** Things the parser couldn't map. Surfaced in the UI as
   *  "we ignored 3 unknown pieces from this plan." */
  warnings: string[];
}

export interface BuyListEntry {
  system_id: string;
  product_code: string;
  /** Display label, derived from `@trackfit/library` if known. */
  label: string;
  /** What the plan needs. */
  required: number;
  /** What the user already owns. */
  on_hand: number;
  /** Difference. Positive = need to buy. Zero / negative = already have enough. */
  to_buy: number;
}

export interface BuyListInput {
  requirements: PlanRequirement[];
  /** Same shape `presetToInventory` emits. We only read `system_id`,
   *  `product_code`, `qty`, `label`. */
  inventory: ReadonlyArray<{
    system_id?: string;
    product_code?: string | null;
    label?: string;
    qty: number;
  }>;
}
