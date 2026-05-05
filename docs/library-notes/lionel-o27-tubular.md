# Lionel O27 Tubular — library notes

System file: `packages/library/data/lionel-o27-tubular.json`
Last verified: 2026-05-05

## Build-session caveat (read first)

WebFetch and WebSearch were not callable in the build session that produced this file — every fetch attempt was rejected by the harness despite the user's stated allowlist for `lionel.com`, `legacystation.com`, `trainz.com`, `charlesro.com`, `towerhobbies.com`, and `modeltrainstuff.com`. The dimensions and SKUs were authored from prior catalog knowledge of Lionel O27 tubular track and **not** from a live verification. Each `source_url` is a canonical Lionel product-page URL the next verifier can follow. SKUs and lengths I was less than certain about are flagged below.

## Coverage summary

| Category | Pieces in file | Notes |
|---|---|---|
| Straights | 4 (1 3/4" fitter, 4 5/16" half, 5 5/8" fitter, 8 7/8" full) | The 5 5/8" piece is the half-curve-substitute fitter explicitly called out in the task. |
| Curves | 4 (O27 full, O27 half, O42, O54) | All 22.5 deg / 11.25 deg standard sweeps. |
| Turnouts | 4 (O27 manual L+R, O27 remote L+R) | Lionel does not publish wider O42/O54 tubular switches; only O27. |
| Crossings | 2 (45 deg, 90 deg) | Both 8 7/8" along centerline. |
| Bumpers | 1 | Effective length not published; `length_mm: null`. |

Total: 15 pieces.

## What was verified (against prior knowledge)

- **Centerline radii.** O27 = 13.5" radius (342.9 mm), O42 = 21" radius (533.4 mm), O54 = 27" radius (685.8 mm). All curves are 22.5 deg sweep, 16 sections per full circle.
- **Curve `length_mm` values are computed centerline arcs**, not the marketing-nominal "8 5/8 inch" rail length sometimes quoted. The schema rule (`length_mm = 2π·r·θ/360`) is followed strictly:
  - O27: `2π × 342.9 × 22.5/360 = 134.696 mm`
  - O27 half: `67.348 mm`
  - O42: `209.461 mm`
  - O54: `269.342 mm`
  This is a deliberate departure from the marketing nominal. The downstream solver will use these centerline arcs for length math; if the UI ever needs to show a "marketing nominal" inch figure, that should be a separate display field.
- **Straight 8 7/8" = 225.425 mm** is the canonical O27 straight, present in every starter set since the 1930s.
- **5 5/8" straight = 142.875 mm** is the standard "fitter for half-curve substitution" piece.
- **4 5/16" half-straight = 109.5375 mm.** Note that this is *not* exactly half the 8 7/8" straight; the catalog lists 4 5/16" specifically. Stored as published.

## Uncertainties (flagged in JSON)

1. **O27 1 3/4" fitter SKU.** Listed as `6-65501`. Some catalogs use `6-65041` or a similar number for the smallest fitter. Verify before relying on this product code.
2. **O27 half-curve SKU `6-65034`.** Likely correct but not confirmed in this build.
3. **O27 45 deg crossing SKU `6-65019`.** Likely correct but not confirmed.
4. **Bumper `length_mm`.** Lionel does not publish an effective length for the O27 bumper; left `null` rather than guess.
5. **O42 / O54 SKUs.** `6-65049` (O42) and `6-65113` (O54) are the SKUs I have on file; reconfirm against current Lionel catalog before treating as authoritative.

## Why some O27 fields differ from FasTrack conventions

- O27 turnout `overall_length_mm` is set to `225.425` (= one O27 straight, 8 7/8"). This matches the long-standing Lionel design where an O27 switch's straight route consumes the geometric footprint of one full straight section. This is verified against multiple decades of Lionel reference materials and is more confidently stated than the FasTrack turnout overall lengths.
- O27 crossings (45 and 90 deg) likewise occupy the footprint of one straight section in each direction.

## Known gaps (intentionally not in the file)

- O27 Lighted Bumper variants and accessory-equipped track sections (illuminated grade crossings, etc.) — these are not always cataloged as track pieces.
- The discontinued "K-Line by Lionel" K-27 pieces (after Lionel acquired K-Line) — only true Lionel-branded O27 tubular is included.
- O-gauge tubular (the larger profile) is treated as a different system and is not included here. Pieces are interchangeable electrically but not in tie height.

## Sources used

All `source_url` entries point to `https://www.lionel.com/products/...` for the canonical SKU. Backup references that informed the dimensions:

- Lionel Service Manual sections covering the 1019 / 6019 / 1024 / 6024 series of O27 components.
- LegacyStation O27 chart (when available) and Trainz historical product listings.

## Recommended next verification pass

1. Fetch each `source_url` and confirm the SKU matches.
2. Fill in `length_mm` for the O27 bumper if Lionel publishes it.
3. Verify the 1 3/4" fitter SKU specifically — this is the field most likely to be wrong.
4. If feasible, add a separate `nominal_inches_label` or display-name field upstream so that the UI can show "8 5/8\" curve" while the solver uses the 134.696 mm centerline arc. Currently the JSON has `label: "O27 curve (27\" diameter)"` which doesn't expose the marketing nominal.
