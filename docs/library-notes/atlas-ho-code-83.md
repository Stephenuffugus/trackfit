# Atlas HO Code 83 — library notes

**System file:** `packages/library/data/atlas-ho-code-83.json`
**Last verified:** 2026-05-05
**Verified by:** library agent (automated draft)

## Verification status: DRAFT — needs manual source pass

**Critical caveat for the next reviewer:** WebFetch and WebSearch were both denied by the harness during this build session, despite being listed in `.claude/settings.local.json`. As a result this file was assembled from the agent's prior knowledge of the Atlas catalog conventions, *not* from a live read of `shop.atlasrr.com` or the cross-check dealer pages. Treat every value below as "needs a source-page eyeball before shipping to users."

The geometry that *is* high-confidence (because it is mathematically forced by the system definition):

- 9" straight = 228.6 mm (9 × 25.4)
- 6" straight = 152.4 mm
- 18" radius, 30° arc curve length = 2π × 457.2 × 30/360 = 239.39 mm
- 22" radius, 30° arc curve length = 2π × 558.8 × 30/360 = 292.59 mm
- All fitter lengths are direct in × 25.4 conversions

The values that are **not** mathematically forced and therefore most need re-verification:

- All product_code SKUs (numbered 521, 522, 523, 526, 527, 528, 529, 540, 551, 560-569). These follow the Atlas convention; close inspection against the live catalog could reveal off-by-one numbering or recent re-numbering.
- All turnout `overall_length_mm` values are `null` — Atlas Customline #4 has historically been published as a 7-1/2" main-route piece, #6 as ~9", #8 as ~12", but I would not commit those numbers without a source page.
- Crossing overall lengths likewise `null`.
- Rerailer length `null` (typically 9" / 228.6 mm same as a standard straight, but unconfirmed).
- Bumper length `null`.

## Sources to use when re-verifying

Primary (manufacturer):

- https://shop.atlasrr.com/c-7-ho-code-83-track.aspx — Code 83 category landing
- https://www.atlasrr.com/Code83HOTrack/code83hotrack.htm — older catalog page on .com (often has dimension drawings)

Cross-check (dealers; useful when the manufacturer page is sparse on dimensions):

- https://www.walthers.com (search "Atlas Code 83")
- https://www.trainz.com
- https://www.modeltrainstuff.com
- https://www.towerhobbies.com

## Coverage gaps

- **Flex track radii.** The user spec listed 22, 24, 26, 28, 30, 32 inch radii under flex. Atlas Super-Flex Code 83 ships as a single 30" (762 mm) flexible section (SKU 520). The radii enumerated in the spec are *user-formed* bend radii a hobbyist commonly chooses, not separate SKUs. The library file therefore contains one flex piece (the 30" nominal section), and the curve solver will need to model flex radius as a continuous user-input rather than a discrete piece.
- **Atlas True-Track HO** (the HO product with integrated roadbed, distinct from O True-Track) is *not* covered here — out of scope for this file, which is plain Code 83 sectional + Customline.
- **Custom-Line vs. Customline.** Atlas spells the HO turnout product line "Customline" (one word). N-scale spells it "Custom-Line" (hyphenated). Reflected in the slugs.
- **Three-way turnout.** Atlas has historically offered a Customline three-way; I recorded SKU 565 but flag it as needs-confirmation.

## Two-source disagreements resolved

None — only one (manufacturer-implied) source was used. When real verification happens, expect at least the dealer pages to differ from atlasrr.com on:

- whether the #4 turnout is sold as a single-package or in a left/right pair
- the exact catalog name of the rerailer (sometimes "terminal section," sometimes "rerailer / terminal," sometimes both terms appear on different pages)

## TODOs

- [ ] Visit shop.atlasrr.com Code 83 listings, confirm every SKU.
- [ ] Fill in `overall_length_mm` for all turnouts and crossings from manufacturer dimension drawings.
- [ ] Confirm whether the 90 degree crossing exists in current Code 83 production (it may be Code 100 only).
- [ ] Add a `notes` field tagging the rerailer with its dual function as power feed.
- [ ] Photograph each piece and link photos in the React app library viewer (Phase 2 deliverable).
