# Atlas N Code 80 — library notes

**System file:** `packages/library/data/atlas-n-code-80.json`
**Last verified:** 2026-05-05
**Verified by:** library agent (automated draft)

## Verification status: DRAFT — needs manual source pass

WebFetch and WebSearch were both denied by the harness during this build session. The data below is assembled from prior knowledge of the Atlas N Code 80 catalog (which has been remarkably stable from the 1980s onward) and from the user's spec, not from a live page read. Re-verify against shop.atlasrr.com before ship.

## High-confidence values (math-forced)

- 5" straight = 127 mm (5 × 25.4)
- 2.5" straight = 63.5 mm
- All fitter lengths are direct in × 25.4 conversions
- All curve arc lengths follow `length_mm = 2π × radius_mm × arc_degrees / 360` with arc_degrees = 30:
  - 11" radius → 146.31 mm arc length
  - 13.75" radius → 182.89 mm
  - 16.25" radius → 216.16 mm
  - 19" radius → 252.69 mm
  - 21.5" radius → 285.96 mm

## Lower-confidence values (need source-page check)

- All SKUs in the 2500-series. The Atlas N numbering is stable, but specific values not re-verified this session.
- The 21.5" radius curve SKU (recorded as 2513) is the value I'm least sure of — Atlas's largest sectional N radius has been published as both 21" and 21.5" in different catalog years. The user spec said 21.5", which matches Atlas's modern publication, but the SKU is plausible-not-confirmed.
- All turnout `overall_length_mm`, `divergence_degrees` — `null`.
- All crossing overall lengths — `null`.
- Snap-Switch effective frog number — `null` (it is geometry-defined as "5 in straight + 19 in curve" rather than by frog ratio; tagging it as ~#4 would be an over-claim).

## Sources to use when re-verifying

Primary:

- https://shop.atlasrr.com/c-5-n-code-80-track.aspx
- https://www.atlasrr.com/NCode80Track/ncode80track.htm

Cross-check:

- https://www.walthers.com
- https://www.trainz.com
- https://www.modeltrainstuff.com
- https://www.towerhobbies.com

## Coverage gaps

- **9-3/4" radius curve.** Atlas N has historically also offered a 9-3/4" (248 mm) radius "tight-radius" curve, often paired with the Snap-Switch's diverging route. The user spec did not list it, so it is omitted; flag for a future enhancement if discontinued-product coverage is wanted.
- **Code 55 N track.** Atlas also produces a Code 55 N line (finer-scale rail). That is a separate library file, not in scope here.
- **Flex track radii.** Same as the HO files: Atlas N Code 80 flex (SKU 2500) ships as a 30" nominal section. User-formed bend radii are not discrete SKUs.
- **Atlas True-Track N** does not exist as a product; True-Track is HO and O only. (Atlas N's roadbed equivalent is the True-Track-style "Master Line" — out of scope here.)
- **Snap-Switch vs. Custom-Line numbering.** Atlas N has both lines. Snap-Switch SKUs 2700/2701 are recorded; Custom-Line #4/#6/Y SKUs 2714-2718 are recorded. Both ranges need confirmation.

## Two-source disagreements resolved

None this session.

## TODOs

- [ ] Live-verify all SKUs.
- [ ] Confirm whether the 21.5" radius curve is current production or has been re-numbered.
- [ ] Add the 9-3/4" radius curve if discontinued-product coverage is decided in scope.
- [ ] Fill in `overall_length_mm` for all turnouts and crossings.
- [ ] Confirm Snap-Switch effective frog number and document as a note rather than a `turnout_frog` value.
