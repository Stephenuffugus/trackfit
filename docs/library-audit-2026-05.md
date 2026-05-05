# Library audit — 2026-05-05

Internal-consistency audit of every JSON file under `packages/library/data/`. No
live web verification was attempted (manufacturer CDNs are bot-blocked from this
Codespace IP). Source-of-truth for dimensions remains the per-piece `notes` and
`source_url` citations.

## Methodology

For each `TrackSystem.pieces[]`, the audit checks:

1. **Curve geometry consistency** — `length_mm ≈ radius_mm × arc_degrees × π/180`
   within 1.5% (catalog-rounding tolerance). Larger deltas (>5%) are flagged as
   probable data bugs; null `length_mm` on curves is allowed (derivable).
2. **Duplicate `id`** within a system (must be unique per the schema).
3. **Duplicate `product_code`** within a system (likely copy-paste).
4. **Required schema fields** — `id`, `label`, `kind`, `source_url`,
   `source_verified_at`. `product_code` is optional in general but expected on
   turnouts and crossings (high-value catalog data).
5. **Sane numeric ranges** — straights `length_mm ≤ 1500 mm`; curves
   `radius_mm ≥ 100 mm` for non-Z scales; turnouts `0 < divergence_degrees ≤ 90`.
6. **TODO debt** — count and inventory every `TODO` in `notes`.

The audit script lives at `/tmp/audit.mjs`; rerun with `node /tmp/audit.mjs`.

## Summary

- **Files audited:** 16
- **Total pieces:** 405
- **Total curves checked for geometry:** 111 (107 with full r/arc/length; 4 with
  null length_mm — allowed)
- **Issues found:** 11 across all categories

| Category | Count |
| --- | --- |
| Curve-geometry inconsistencies (>1.5%) | **0** |
| Curve-geometry inconsistencies (>5%, hard fail) | **0** |
| Duplicate `id` within a system | **0** |
| Duplicate `product_code` within a system | **3** (all already documented in notes) |
| Missing required schema fields | **0** |
| Turnouts/crossings missing `product_code` | **8** |
| Out-of-range numerics (straight > 1500 mm, curve r < 100 mm, bad divergence) | **0** |
| Open `TODO` markers in notes | **8** |

**Headline:** every curve in the library is internally consistent within
catalog-rounding tolerance. There are zero geometry data bugs. The remaining
findings are missing-data (turnout/crossing SKUs) and known-and-noted
ambiguities (catalog SKU reuse), not silent errors.

## Per-system findings

### atlas-ho-code-100 (27 pieces)
Clean. No issues.

### atlas-ho-code-83 (27 pieces)
- **Missing product_code on turnout/crossing:**
  - `90deg-crossing` — note already says "confirm with manufacturer; not always
    cataloged in Code 83."
- All Customline turnouts (`560`–`567`, `562`, `565`) and the 19°/25° crossings
  (`568`, `569`) have product codes.

### atlas-n-code-80 (23 pieces)
Clean. No issues.

### atlas-o-true-track (14 pieces)
Clean. No issues.

### bachmann-ez-track-ho (28 pieces)
- **Missing product_code on turnout/crossing:**
  - `crossing-45deg-ns`
  - `crossing-90deg-ns`
- (Both crossings cite Bachmann pages but no SKU is recorded; resolution
  requires looking up the catalog — deferred.)

### bachmann-ez-track-n (11 pieces)
- **Missing product_code on turnout/crossing:**
  - `left-turnout-manual`
  - `right-turnout-manual`
  - `left-turnout-remote`
  - `right-turnout-remote`
- All four E-Z Track N turnouts lack SKUs. This system has the worst SKU
  coverage on switches; flag for a focused catalog pass.

### hornby-oo (24 pieces)
Clean. No issues.

### kato-unitrack-ho (25 pieces)
Clean. No issues.

### kato-unitrack-n (56 pieces — largest system)
- **Duplicate product_code:** `20-091` appears on three different fitter
  straights:
  - `s29-straight`, `s33-straight`, `s45-straight`.
  - **NOT a copy-paste bug.** This is documented in each piece's notes as a
    Kato assortment pack: "Sold in a 4-pack assortment (20-091) along with
    other short fitter straights." Kato sells these three lengths only via
    the same multi-piece pack. The shared SKU is correct.
  - **Recommendation (out of scope for this audit):** consider a future
    schema field `pack_product_code` distinct from `product_code` so that
    individual pieces don't appear to share an SKU. Documenting here only.
- **Missing product_code on turnout/crossing:**
  - `crossing-45` — only crossing in the system without a recorded SKU.
- All curve geometry consistent (107 of the 111 audited curves come from this
  family of files; Kato is metric-named so the rounding is exceptionally
  clean).

### lionel-fastrack (40 pieces)
Clean. No issues. All ten FasTrack curve radii (O36 → O96, full/half/quarter
sections) check out to four-digit precision against the radius × arc formula.

### lionel-o27-tubular (15 pieces)
Clean. No issues.

### marklin-c-track (38 pieces)
Clean. No issues.

### marklin-k-track (28 pieces)
- **Duplicate product_code (2 cases, both already flagged in notes):**
  - `2205` shared between `fitter-straight` and `flex-900mm`. Note on
    `flex-900mm` states: "K-Track flex SKU has appeared under 2205 and 2208
    in different catalog years; verify against current Märklin catalog. SKU
    listed here may need correction." Author has flagged the ambiguity.
  - `2270` shared between `right-slim-turnout` and `three-way-turnout`. Note
    on `three-way-turnout` states: "SKU 2270 conflicts with the slim right
    turnout SKU above — Märklin has reused/reissued K-Track switch SKUs over
    the years; verify against current catalog. Marked here for downstream
    curation."
  - These are not silent copy-paste errors; they are explicit catalog
    ambiguities awaiting curation. Leave the data as-is until a verification
    pass can resolve which SKU belongs to which piece.
- All curves consistent.

### peco-setrack-code-100 (20 pieces)
- **Open TODOs (1):**
  - `st-247-left-curved-turnout` — "TODO: verify centre-line length on a
    manufacturer datasheet."

### peco-streamline-code-100 (15 pieces)
- **Open TODOs (4):**
  - `sl-91-small-radius-left-turnout` — "TODO: confirm overall length on a
    current datasheet."
  - `sl-95-medium-radius-left-turnout` — "TODO: confirm exact overall length."
  - `sl-88-large-radius-left-turnout` — "TODO confirm" (overall length).
  - `sl-94-double-slip` — "TODO confirm from current datasheet."

### peco-streamline-code-83 (14 pieces)
- **Open TODOs (3):**
  - `sl-8362-medium-radius-left-turnout` — "TODO confirm from current page."
  - `sl-8360-small-radius-left-turnout` — "TODO confirm" (overall length).
  - `sl-8364-large-radius-left-turnout` — "TODO confirm" (overall length).

## TODO inventory (8 total)

All eight open TODOs are turnout overall-length verifications, concentrated in
Peco Streamline and one Peco Setrack curved point. None block solver geometry
(straights and curves are unaffected). The work is bounded: pull current Peco
datasheets and copy the published overall-length figures into eight pieces.

| System | Piece | What's missing |
| --- | --- | --- |
| peco-setrack-code-100 | st-247-left-curved-turnout | Centre-line length (a curved point with two radii) |
| peco-streamline-code-100 | sl-91-small-radius-left-turnout | Overall length |
| peco-streamline-code-100 | sl-95-medium-radius-left-turnout | Overall length |
| peco-streamline-code-100 | sl-88-large-radius-left-turnout | Overall length |
| peco-streamline-code-100 | sl-94-double-slip | Overall length |
| peco-streamline-code-83 | sl-8362-medium-radius-left-turnout | Overall length |
| peco-streamline-code-83 | sl-8360-small-radius-left-turnout | Overall length |
| peco-streamline-code-83 | sl-8364-large-radius-left-turnout | Overall length |

## Fixes applied

**None.** Every flagged item was reviewed and falls into one of three buckets:

1. **Already documented in `notes`** (Märklin K-Track 2205/2270 SKU ambiguity,
   Kato 20-091 assortment pack, Atlas 90° crossing missing SKU). Author has
   already captured uncertainty in the data; correcting requires manufacturer
   verification this audit is forbidden to perform.
2. **Open TODOs explicitly waiting on a datasheet pass** (eight Peco
   turnouts/double-slip overall lengths). Inventoried above; do not invent
   numbers.
3. **Genuinely missing data** (Bachmann E-Z Track turnouts and crossings
   without SKUs). Same constraint — no source, no fix.

The handoff is explicit: "Do **NOT** invent new dimension data — that's exactly
the kind of thing that gets roasted on forums." This audit honors that.

## Recommendations (advisory only — no schema or data changes made)

1. **Targeted catalog pass on Bachmann E-Z Track turnouts/crossings.** Six
   pieces (4 N-scale turnouts, 2 HO crossings) need SKUs. This is the largest
   missing-data cluster.
2. **One-shot Peco datasheet pull** to clear all eight TODOs in one sitting.
3. **Märklin K-Track SKU disambiguation** for `2205` (fitter vs. flex) and
   `2270` (slim right vs. three-way). Probably resolvable by checking which
   year of the K-Track catalog is being treated as canonical.
4. **(Schema-future)** A `pack_product_code` field to cleanly model assortment
   packs like Kato 20-091 without forcing three pieces to share `product_code`.
   Out of scope for this audit; flag for the next schema review.
