# Atlas HO Code 100 — library notes

**System file:** `packages/library/data/atlas-ho-code-100.json`
**Last verified:** 2026-05-05
**Verified by:** library agent (automated draft)

## Verification status: DRAFT — needs manual source pass

Same caveat as the Code 83 file: WebFetch/WebSearch were denied during this session, so values are assembled from prior knowledge of Atlas catalog conventions and not from a live page read. Treat as "needs eyeballing before ship."

## The Code 83 / Code 100 relationship

Per the user's hard rule and per the Atlas catalog itself: **geometry is identical between Code 83 and Code 100. Only the rail height differs (0.083 in vs 0.100 in).** That means every length, radius, and arc value in this file should match the Code 83 file piece-for-piece. The two files exist as separate libraries because users choose them as separate products and SKUs differ. If a future audit finds the geometry diverging between the two files, it is almost certainly a bug in this file or its sibling, not a real product difference.

## High-confidence values (math-forced)

- 9" straight = 228.6 mm
- 6" straight = 152.4 mm
- 18" radius / 30° arc curve = 239.39 mm centerline arc
- 22" radius / 30° arc curve = 292.59 mm centerline arc
- All fitter lengths are direct conversions

## Lower-confidence values (need source-page check)

- All SKUs in the 821-848 / 850-857 range. The Atlas Code 100 numbering convention dates back to the 1960s and is fairly stable, but specific values were not re-verified in this session.
- All turnout `overall_length_mm`, `divergence_degrees` — `null`.
- All crossing overall lengths — `null`.
- Rerailer length — `null` (probably 228.6 mm).
- Bumper length — `null`.

## Sources to use when re-verifying

Primary:

- https://shop.atlasrr.com/c-6-ho-code-100-track.aspx
- https://www.atlasrr.com/Code100HOTrack/code100hotrack.htm

Cross-check:

- https://www.walthers.com
- https://www.trainz.com
- https://www.modeltrainstuff.com
- https://www.towerhobbies.com

## Coverage gaps

- Flex track: same situation as Code 83. Atlas Super-Flex Code 100 ships as a 30" nominal section (SKU 168). User-formed radii are not discrete SKUs. The 22/24/26/28/30/32 in radii in the original spec describe layout-design choices, not products.
- Older Atlas HO Code 100 had a "Snap-Switch" product distinct from Customline — I did not include it as it has been long discontinued. Worth adding if the user wants discontinued-product coverage for second-hand inventories (which is a likely Trackfit use case — older hobbyists often have decades-old track piles).

## Two-source disagreements resolved

None this session.

## TODOs

- [ ] Live-verify all SKUs against shop.atlasrr.com.
- [ ] Confirm geometry is bit-for-bit identical to Code 83 file (lengths, radii, arc degrees). Any divergence should be reconciled.
- [ ] Add discontinued Snap-Switch entries if the product team wants pre-1990s coverage.
- [ ] Fill in `overall_length_mm` for all turnouts and crossings.
- [ ] Photograph each piece for library UI.
