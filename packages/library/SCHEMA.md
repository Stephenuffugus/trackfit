# Trackfit track-library schema (v1)

Every library JSON file **must** validate against this schema. Library agents are working in parallel; consistency here is the contract that lets the data flow into `packages/solver` and the React app without rework.

## TypeScript

```ts
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

export interface TrackPiece {
  /** stable kebab-case slug, scoped per system. e.g. "10in-straight" */
  id: string;
  /** manufacturer SKU. null if not published. e.g. "6-12014" */
  product_code: string | null;
  /** display label as it should appear in the UI, e.g. '10" straight' */
  label: string;
  kind: TrackKind;
  /** straights/fitters/flex: nominal length. curves: arc length along centerline. mm. */
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
  /** ISO 8601 date the source was checked. e.g. "2026-05-05" */
  source_verified_at: string;
  /** free-form notes; especially for any "I'm not 100% sure" caveats */
  notes?: string;
}

export interface TrackSystem {
  /** kebab-case unique system id, e.g. "lionel-fastrack" */
  id: string;
  /** display name, e.g. "Lionel FasTrack" */
  name: string;
  /** e.g. "Lionel" */
  manufacturer: string;
  scale: Scale;
  /** UI default; users can switch */
  default_unit: "in" | "mm";
  /** short prose overview — when to use this library, what's special */
  description?: string;
  /**
   * Editorial state of this system's data.
   *  - "unverified-draft" — geometry math hand-computed; SKUs/URLs from training data, not live-checked. Show a "draft" badge in UI; do NOT cite as authoritative.
   *  - "partially-verified" — some pieces re-checked against the manufacturer; others still draft. See per-piece source_verified_at.
   *  - "verified" — every piece has a non-null source_verified_at within the last 12 months.
   */
  data_quality?: "unverified-draft" | "partially-verified" | "verified";
  /** human-readable note explaining what was/wasn't verified, when, and by whom */
  data_quality_note?: string;
  pieces: TrackPiece[];
}
```

## Hard rules for library authors

1. **All lengths in millimeters.** Convert from inches at write time (`in × 25.4`). The UI handles unit display. Don't store inches anywhere in JSON.
2. **Cite every piece.** `source_url` must point to a manufacturer page or authoritative dealer (Walthers, Trainz, ModelTrainStuff, Tower Hobbies). Not forum posts. Not Wikipedia. Same `source_url` may repeat across many pieces in the same system.
3. **Empty is honest, wrong is fatal.** If a dimension is unclear or unpublished, write `null` and document in `notes` and in `docs/library-notes/{system-id}.md`. Do **not** guess.
4. **Curves: store both arc length and radius+arc_degrees.** `length_mm = 2π × radius_mm × (arc_degrees / 360)`. If radius is given but arc length isn't, compute it. If arc length is given but radius+arc_degrees isn't, write `null`s and note it.
5. **Turnouts/crossings:** focus on `overall_length_mm` (the route-length contribution to the gap solver). Frog number and divergence angle are nice-to-haves; null if unpublished.
6. **`id` uniqueness:** kebab-case, scoped within the system file, descriptive of geometry not SKU. e.g. `"10in-straight"`, `"r3-22deg-curve"`, `"left-4-turnout"`. The full canonical id is `{system.id}/{piece.id}` — this is implicit; piece-level id stays scoped.
7. **`product_code`:** the SKU as the manufacturer publishes it (`"6-12014"`, `"851-50"`, etc.). Null if it's a generic-pack-only piece.
8. **Filename:** `packages/library/data/{system.id}.json`. One file per system. UTF-8, two-space indent.

## Per-system markdown notes

Alongside the JSON, write `docs/library-notes/{system-id}.md`:

- What was verified vs inferred vs uncertain.
- Source URLs used (with last-checked date).
- Coverage gaps (e.g. "didn't include the discontinued 1990s-era K-3 because the catalog spec is unclear; tagged with TODO").
- Any pieces where two sources disagreed and how that was resolved.

This is so the user (and eventually crowdsourced verifiers) can audit our data accuracy without reverse-engineering the JSON.
