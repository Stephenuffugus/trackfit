# Atlas O 21st Century / True-Track — library notes

**System file:** `packages/library/data/atlas-o-true-track.json`
**Last verified:** 2026-05-05
**Verified by:** library agent (automated draft)

## Verification status: DRAFT — needs significant manual source pass

This file is the **least-confident** of the four Atlas libraries built in this session. Reasons:

1. WebFetch/WebSearch were denied — same as for the other three files.
2. Atlas O True-Track / 21st Century has had at least two product-line revisions (the original 21st Century Track and the later True-Track with integrated roadbed) and the SKU mapping between them is not clean.
3. Per-section arc degrees for True-Track curves vary by diameter and the per-section count per circle is not something I am willing to commit to a number on without seeing the catalog. **All `arc_degrees` and `length_mm` for curves are therefore `null` in the JSON.**

## What's in scope

Per the user's spec: straights, curves at O36 / O45 / O54 / O72, switches.

## High-confidence values

- 10" straight = 254 mm (10 × 25.4)
- 5" straight = 127 mm
- Diameter → centerline radius conversions:
  - O36 = 36" diameter → 18" radius → 457.2 mm
  - O45 = 45" diameter → 22.5" radius → 571.5 mm
  - O54 = 54" diameter → 27" radius → 685.8 mm
  - O72 = 72" diameter → 36" radius → 914.4 mm

The diameter-not-radius convention is the O-gauge community standard (Lionel and MTH use it too) and is faithfully encoded in the `radius_mm` field by halving + converting.

## Low-confidence / null values

- **All curve `arc_degrees` and `length_mm`.** The user's hard rule explicitly says curves must store both arc length and radius+arc_degrees. Until the per-section arc count is confirmed against shop.atlasrr.com, these values are `null` and the curve cannot fully participate in the gap solver. This is the single biggest gap in this library.
- All SKUs (6050, 6051, 6052, 6060-6063, 6080-6085) — these are plausible Atlas O numbering but not confirmed.
- Switch overall lengths and divergence angles — `null`.
- Switch effective frog numbers (recorded as #5 for O54, #7.5 for O72) — these are community conventions, not Atlas-published values.

## Sources to use when re-verifying

Primary:

- https://shop.atlasrr.com/c-9-o-true-track.aspx
- https://www.atlasrr.com/TrueTrackO/truetrack.htm
- https://www.atlasrr.com/21stCenturyTrack/21stcenturytrack.htm (older 21st Century landing page)

Cross-check:

- https://www.walthers.com (search "Atlas O True-Track")
- https://www.trainz.com
- https://www.modeltrainstuff.com
- https://www.towerhobbies.com

## Coverage gaps

- **Arc geometry.** As above, the most important gap. The whole point of having radius_mm and arc_degrees is so the curve solver can do its job; until the arcs are filled in, the O True-Track library cannot drive the curve solver.
- **21st Century vs True-Track.** These are two distinct Atlas O sectional systems with overlapping but not identical SKUs. The library file is named `atlas-o-true-track` and labeled as "21st Century / True-Track" but the data leans toward True-Track. If the product team wants both as separate systems, this file should be split.
- **Crossings.** Atlas O does offer 90° crossings; not listed here because the user spec didn't include them.
- **Bumpers and rerailers.** Same — not in user spec, not included.
- **Half-curves and split-curves.** Atlas True-Track has shorter / partial curve sections in some diameters. Not represented.

## Two-source disagreements resolved

None this session.

## TODOs

- [ ] **Highest priority:** confirm per-section arc count for each diameter (O36, O45, O54, O72) and fill in `arc_degrees` and computed `length_mm` for every curve piece.
- [ ] Live-verify all SKUs.
- [ ] Decide whether to split into two systems (`atlas-o-21st-century` and `atlas-o-true-track`) or keep as one.
- [ ] Fill in switch `overall_length_mm` from manufacturer dimension drawings.
- [ ] Add bumpers, rerailers, crossings if scope expands.
- [ ] Photograph each piece.
