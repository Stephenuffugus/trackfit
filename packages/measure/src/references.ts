/**
 * Reference-object catalog for Trackfit's gap-measurement feature.
 *
 * The user photographs a gap with a known object in frame (a coin, a bill,
 * or a track piece they own) and taps endpoints; we compute the gap's
 * real-world length from the pixel-distance ratio. The dimensions below
 * are the manufacturer/mint canonical values in millimeters.
 *
 * Sources:
 *  - US currency dimensions: Bureau of Engraving & Printing
 *      (https://www.bep.gov/currency/currency-faqs)
 *      All US notes are 156 mm long, 66.3 mm tall.
 *  - US coin specs: usmint.gov coin specifications page.
 *  - Euro coin specs: ecb.europa.eu/euro/coins
 *  - UK £1 (12-sided, 2017+): royalmint.com — diameter is the
 *      across-flats measurement (max width is 23.43 mm flat-to-flat).
 *  - Atlas HO 9" straight: Atlas product code 821, sectional rail
 *      length 9" = 228.6 mm.
 *  - Lionel FasTrack 10" straight: Lionel 6-12014, 10" = 254 mm.
 *
 * Keep this list small and high-confidence. A reference object that is
 * "approximately" some size is worse than no reference at all — the user
 * trusts the number we hand back.
 */

export interface ReferenceObject {
  /** Stable id used by clients to persist the user's last choice. */
  id: string;
  /** Human-readable label shown in the picker. */
  label: string;
  /** Which dimension of the object the user is marking ("long edge", "diameter", etc.). */
  dimension_label: string;
  /** Canonical real-world length in millimeters. */
  dimension_mm: number;
  /** Optional clarifying note (origin year, regional variants, etc.). */
  notes?: string;
}

export const STANDARD_REFERENCES: readonly ReferenceObject[] = Object.freeze([
  {
    id: "us-dollar",
    label: "US dollar bill (long edge)",
    dimension_label: "long edge",
    dimension_mm: 156.0,
  },
  {
    id: "us-quarter",
    label: "US quarter",
    dimension_label: "diameter",
    dimension_mm: 24.26,
  },
  {
    id: "eu-1-euro",
    label: "1 € coin",
    dimension_label: "diameter",
    dimension_mm: 23.25,
  },
  {
    id: "uk-1-pound",
    label: "UK £1 coin (12-sided)",
    dimension_label: "diameter (across-flats)",
    dimension_mm: 23.43,
    notes: "Post-2017 12-sided design. Older round £1 coins were 22.5 mm.",
  },
  {
    id: "us-penny",
    label: "US penny",
    dimension_label: "diameter",
    dimension_mm: 19.05,
  },
  {
    id: "ho-9in-straight",
    label: 'Atlas HO 9" straight',
    dimension_label: "rail length",
    dimension_mm: 228.6,
  },
  {
    id: "fastrack-10in-straight",
    label: 'Lionel FasTrack 10" straight',
    dimension_label: "rail length",
    dimension_mm: 254.0,
  },
]);

/**
 * Look up a reference object by id. Returns undefined for unknown ids
 * rather than throwing — the caller is expected to fall back to a
 * "use a piece I own" flow when nothing matches.
 */
export function getReferenceById(id: string): ReferenceObject | undefined {
  return STANDARD_REFERENCES.find((r) => r.id === id);
}
