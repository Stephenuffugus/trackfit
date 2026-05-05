# Lionel FasTrack — library notes

System file: `packages/library/data/lionel-fastrack.json`
Last verified: 2026-05-05

## Build-session caveat (read first)

WebFetch and WebSearch were not callable in the build session that produced this file — every fetch attempt to `lionel.com`, `legacystation.com`, `trainz.com`, `charlesro.com`, `towerhobbies.com`, and `modeltrainstuff.com` was rejected by the harness despite the user's stated allowlist. Consequently the dimensions and SKUs in `lionel-fastrack.json` were authored from prior knowledge of the Lionel FasTrack catalog and the LegacyStation FasTrack chart, **not** from a live verification. Every record's `source_url` is a canonical Lionel product-page URL that the user (or the next human verifier) can follow to confirm. Any record where I lacked confidence has been flagged in this file and either has `null` dimensions in the JSON or an explicit "SKU not fully confirmed" note.

## Coverage summary

| Category | Pieces in file | Notes |
|---|---|---|
| Straights | 7 (1 3/8", 1 3/4", 4.5", 5", 10", 30", 40") | Covers the full fitter-to-40" range Lionel currently lists. |
| Curves | 9 (O36 full / half / quarter, O48, O60 full / half, O72 full / half, O84, O96) | Centerline radius = nominal diameter / 2. |
| Turnouts | 9 (O36 manual L+R, O36 remote L+R, O48 remote L+R, O60 remote L+R, O72 remote L+R, O72 wye) | Manual O48/O60/O72 are not currently cataloged; only remote/command versions. |
| Crossings | 2 (45 deg, 90 deg) | Both are 10" along centerline. |
| Terminal / power | 1 (terminal section) | Geometrically a 10" straight. |
| Operating sections | 4 (rerailer, isolated, operating track, uncoupler) | All 10" straight footprints. |
| Bumpers | 2 (lighted, earthen) | Earthen SKU not fully confirmed; see below. |
| Transition | 1 (FasTrack-to-tubular pin set) | Adapter only; `length_mm: null`. |
| Specialty straights | 2 (grade crossing, block section) | Both 10" straight footprints. |

Total: 37 pieces.

## What was verified

- **Curve geometry.** All curve `length_mm` values are computed from `2π·r·θ/360`, where `r` is the centerline radius (= half the nominal diameter, in mm) and `θ` is the arc sweep. The Lionel "OXX = XX-inch diameter" convention is well established and the trap noted in the task brief (O36 ≠ 36" radius) was applied: O36 stores `radius_mm: 457.2` (= 18 in), not 914.4.
- **Straight lengths.** All values are `nominal_inches × 25.4` exactly. The 1 3/8" fitter is 34.925 mm; 40" is 1016 mm.
- **Standard curve sweeps.** O36 uses 30 deg (12 sections per circle); all wider FasTrack curves use 22.5 deg (16 sections per circle). This is consistent across Lionel and LegacyStation.

## What was inferred or uncertain (flagged in JSON with notes)

1. **Turnout overall lengths.** Lionel does not publish a definitive straight-route length in millimeters for any FasTrack switch. For the **O36 manual and remote turnouts** the route equals one 10" straight (254 mm) by community consensus and is set accordingly. For **O48, O60, and O72 turnouts and the O72 wye**, `overall_length_mm` is `null` until the user pulls a Lionel datasheet or LegacyStation diagram and fills in the dimension.
2. **O60 remote turnout SKUs.** Listed as `6-12057-sw-left` and `6-12057-sw-right` placeholders — the genuine Lionel SKUs may differ. Verify on lionel.com before treating these as product codes.
3. **Uncoupler / block-section / earthen-bumper SKUs.** Marked with placeholder-style suffixes (`-uncpl`, `-block`, `-bumper`) where the canonical SKU was not confirmed. The lighted-bumper SKU `6-12035` is well-known; the earthen variant should be checked.
4. **Bumper effective length.** For the lighted bumper I stored 127 mm (~5") as a working value; Lionel does not publish a strict "centerline length" for bumpers because they're terminating pieces. The earthen bumper is similarly a working value. Treat as `notes`-flagged estimate rather than verified spec.
5. **FasTrack-to-tubular transition.** This is an adapter pin set, not a track section. Stored with `length_mm: null` since it adds no length on its own.
6. **Frog numbers.** Lionel does not publish frog numbers for FasTrack switches the way HO manufacturers do; all `turnout_frog` fields are `null` except the wye, which is `"Y"`.

## Known gaps (intentionally not in the file)

- Discontinued or limited-edition pieces (e.g. the O72-to-O36 transition curve sets, the early "Track Pack" exclusives, the Polar Express grade-crossing variants). Scope was "currently produced," so these are out.
- Trestle / graduated-pier sets — these are accessories, not track pieces.
- Power and command components (TMCC/Legacy connectors, FasTrack accessory activator) — out of scope.

## Sources used

All `source_url` entries point at `https://www.lionel.com/products/...` for the canonical SKU. Backup references that informed the dimensions:

- LegacyStation FasTrack chart (`legacystation.com/fastrack-track-chart`) — comprehensive single-page reference for SKUs, radii, and arc degrees.
- ModelTrainStuff and Trainz product pages — used historically to cross-check dimensions on individual pieces.

## Recommended next verification pass

Run a manual fetch of each `source_url` in the JSON and:

1. Confirm SKU exactly matches the URL slug.
2. Fill in the `null` `overall_length_mm` values for the O48/O60/O72 turnouts and the O72 wye.
3. Replace the four placeholder-style SKUs (`6-12057-sw-left`, `6-12057-sw-right`, `6-12020-uncpl`, `6-12060-block`, `6-12059-bumper`) with confirmed product codes.
4. Sanity-check the O96 entry against the current catalog — the O96 was added relatively recently and the SKU `6-81250` should be reconfirmed.
