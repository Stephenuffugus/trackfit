/**
 * Trackfit layout-suggester types.
 *
 * The suggester answers the hobbyist question every existing tool dodges:
 * "I have this pile of track — what can I build with it?". It works by
 * scoring the user's inventory against a small, hand-tuned catalog of
 * named layout templates (see `catalog.ts`). No LLM, no web access,
 * pure rule-based math.
 *
 * Numbers in `requirements` are *minimums*. The matcher rewards inventories
 * that meet or exceed them and reports a concrete shortfall when they
 * don't, so the user gets an actionable "you need one more 9-inch straight"
 * shopping list instead of a vague "almost".
 */
import type { Scale, TrackKind } from "@trackfit/library";

/**
 * A single named layout template. Hand-authored — these are conceptual
 * blueprints, not exact piece-by-piece schematics. Numbers are tuned to
 * be plausible-not-precise; the suggester is a pre-purchase guide, not
 * a CAD tool.
 */
export interface LayoutTemplate {
  /** stable kebab-case slug */
  id: string;
  /** display name, e.g. "Small oval" */
  name: string;
  /** plain-English description for older audiences (no jargon) */
  description: string;
  /**
   * Scales this template applies to. `null` means "any scale".
   * Templates with scale-specific footprints (e.g. Christmas tree loop)
   * pin their list explicitly so an N-scale user doesn't get matched
   * against an HO-only sized footprint.
   */
  scales: Scale[] | null;
  /**
   * Required pieces for the loop, expressed as parameterised counts.
   * Numbers refer to *minimums*; the matcher fills extras with
   * optional pieces. A "closed loop" layout always has
   * `curve_total_degrees % 360 === 0`.
   */
  requirements: {
    /** total straight length needed, mm */
    straight_length_mm: number;
    /** total curve sweep needed, degrees */
    curve_total_degrees: number;
    /**
     * Specific radius window if the layout demands it (e.g. a
     * tight Christmas-tree oval needs ≤ 600mm radius curves).
     * `undefined` means "any radius is fine".
     */
    max_curve_radius_mm?: number;
    min_curve_radius_mm?: number;
    /** turnouts needed for this layout */
    turnouts?: number;
    /** crossings */
    crossings?: number;
  };
  /** rough footprint, mm */
  footprint: { width_mm: number; depth_mm: number };
  /** ASCII sketch — 8 lines max — for the result card */
  ascii_sketch: string;
  /**
   * Loose category for the filter UI. Hobbyists pick a chip
   * ("Continuous loop", "Switching", "Showcase", "Beginner") that maps
   * onto these values; templates pin one each.
   */
  style: "continuous-loop" | "switching" | "showcase" | "starter";
  /**
   * Rough complexity, 1-5 (5 = ambitious). Helps a beginner avoid the
   * yard ladder; helps an experienced user sort to it.
   */
  complexity: 1 | 2 | 3 | 4 | 5;
  /**
   * One-sentence pitch for *why* a hobbyist would build this layout.
   * Shown italic above the description in the result card.
   */
  appeal: string;
}

/**
 * The shape of inventory passed to the suggester. Mirrors the curve
 * solver's `CurveInventoryItem` field set so the web app can pass the
 * same row objects through with no translation.
 */
export interface SuggesterInventoryItem {
  label: string;
  kind: TrackKind;
  /** straights/fitters/flex: nominal length, mm. curves: arc length, mm. null otherwise. */
  length_mm: number | null;
  /** curves only — radius along centerline, mm */
  radius_mm?: number | null;
  /** curves only — arc sweep, degrees */
  arc_degrees?: number | null;
  /** how many of this piece the user owns */
  qty: number;
}

export interface SuggesterInput {
  inventory: SuggesterInventoryItem[];
  /** optional scale hint; when set, scale-specific templates are filtered */
  scale?: Scale;
  /** if true, compact-footprint templates are nudged up the rankings */
  prefer_compact?: boolean;
}

/** What the user is missing to actually build the template. */
export interface LayoutShortfall {
  straight_length_mm: number;
  curve_total_degrees: number;
  turnouts: number;
  crossings: number;
}

export interface LayoutSuggestion {
  template: LayoutTemplate;
  /** how well your inventory matches the template, 0..1 */
  match_score: number;
  /** what's missing — concrete shopping list */
  shortfall: LayoutShortfall;
  /** if every shortfall is zero, the user can build this today */
  buildable: boolean;
  /** a 1-2 sentence "why this layout" suggestion in plain English */
  rationale: string;
  /**
   * Number of shortfall axes (straight length, curve sweep, turnouts,
   * crossings) where the user is short. 0 when buildable. Used as a
   * within-score-window tiebreaker so a near-miss on one axis ranks
   * above a near-miss spread across many. Optional so consumers can
   * ignore it.
   */
  axes_short?: number;
}
