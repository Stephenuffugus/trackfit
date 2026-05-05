/**
 * Trackfit track-library types.
 * The canonical contract is `packages/library/SCHEMA.md`. Every JSON file
 * under `packages/library/data/` validates against TrackSystem.
 */

export type TrackKind =
  | "straight"
  | "curve"
  | "turnout"
  | "crossing"
  | "fitter"
  | "flex"
  | "rerailer"
  | "bumper"
  | "uncoupler"
  | "transition";

export type Scale = "Z" | "N" | "TT" | "HO" | "OO" | "S" | "O" | "G";

export type DataQuality = "unverified-draft" | "partially-verified" | "verified";

export interface TrackPiece {
  /** stable kebab-case slug, scoped per system */
  id: string;
  /** manufacturer SKU. null if not published */
  product_code: string | null;
  /** display label as it should appear in the UI */
  label: string;
  kind: TrackKind;
  /** straights/fitters/flex: nominal length. curves: arc length along centerline */
  length_mm: number | null;
  /** curves only — radius along centerline */
  radius_mm?: number | null;
  /** curves only — arc sweep, degrees */
  arc_degrees?: number | null;
  /** turnouts only — frog number e.g. "#4", "#6", "Y" */
  turnout_frog?: string | null;
  /** turnouts/crossings — overall length along main route, mm */
  overall_length_mm?: number | null;
  /** turnouts — divergence angle in degrees */
  divergence_degrees?: number | null;
  /** flex track — nominal full length; user is expected to cut */
  flex_nominal_length_mm?: number | null;
  /** required citation — manufacturer or authoritative dealer page */
  source_url: string;
  /** ISO 8601 date the source was checked. null if unverified */
  source_verified_at: string | null;
  /** free-form notes; especially for "I'm not 100% sure" caveats */
  notes?: string;
}

export interface TrackSystem {
  id: string;
  name: string;
  manufacturer: string;
  scale: Scale;
  default_unit: "in" | "mm";
  description?: string;
  /** editorial state — UI should badge unverified-draft systems clearly */
  data_quality?: DataQuality;
  /** human-readable note explaining what was/wasn't verified */
  data_quality_note?: string;
  pieces: TrackPiece[];
}
