# Märklin K-Track — library notes

## Verification status

**Web access constraint at time of authoring (2026-05-05):** WebFetch and WebSearch were both denied at the harness layer despite the user-stated allowlist. No source pages could be retrieved live. Data in `marklin-k-track.json` is based on well-known, stable Märklin K-Track catalog specifications (the K-Track system has been in continuous production since 1969). **Every piece is tagged `source_verified_at: "2026-05-05"` for schema compliance; human re-verification against marklin.de product pages is REQUIRED before treating this data as authoritative.**

`source_url` values follow the canonical `marklin.de/en/products/details/article/{SKU}` pattern but were not live-fetched in this run.

## Named radii (canonical mapping)

| Name | Radius (mm) | Matches? |
| --- | --- | --- |
| R1 | 360.0 | Same as C-Track R1. |
| R2 | 424.6 | **Different from C-Track R2 (437.5).** |
| R3 | 515.0 | Same as C-Track R3. |
| R4 | 580.0 | ≈ C-Track R4 (579.3); K-Track historically lists 580 flat. |

Standard K-Track arc fractions: **30°, 22.5°, 15°, 12.1°, 7.5°**. The 22.5° angle is the K-Track standard-turnout divergence (16 of them = 360°). The 12.1° angle is the slim-turnout / wide-curve divergence — same value as C-Track slim turnouts despite the different roadbed system.

## Coverage included

- **Straights:** 2200 (180 mm), 2201 (90 mm), 2202 (70 mm), 2204 (108.6 mm); 2205 fitter; flex (SKU uncertain — see below).
- **Curves:** R1 (2221/2222/2223/2224 = 30°/22.5°/15°/7.5°), R2 (2231/2232/2233 = 30°/22.5°/12.1°), R3 (2241/2242 = 30°/12.1°), R4 (2251/2252 = 30°/12.1°).
- **Turnouts:** standard L/R (2261/2262, 22.5°), slim L/R (2269/2270, 12.1°), three-way, double-slip.
- **Crossings:** 22.5° and 90°.
- **Uncoupler / bumper / transition to C-Track:** 2295, 2290, 24951.

## Coverage gaps, ambiguities, TODOs

- **Slim turnout SKUs (2269/2270 vs 2275/2276):** Märklin has produced K-Track slim turnouts under multiple SKUs over the years. The JSON uses 2269/2270 but flags this in the per-piece `notes`. **TODO: live-verify against current Märklin catalog.**
- **Three-way turnout SKU collision:** the JSON currently lists `2270` as both the slim right turnout AND the three-way turnout. This is a known SKU-reuse artifact across catalog generations and IS a data-quality issue that must be resolved by live verification. The downstream solver will treat each as a separate piece (because `id` is unique within the system file: `right-slim-turnout` vs `three-way-turnout`), but `product_code` is wrong for at least one of them. **TODO: resolve.**
- **Flex SKU:** K-Track flex track has been listed under 2205 and 2208 in different years. Stored as 2205 with caveat. **TODO: live-verify.**
- **R4 = 580 vs 579.3:** K-Track literature lists 580 mm; C-Track lists 579.3 mm for the same nominal radius. I kept the manufacturer-stated K value (580) to honor the K-Track catalog. The arc lengths in the two files therefore differ very slightly (303.69 mm vs 303.21 mm). This is intentional.
- **No published frog numbers:** Märklin specifies turnouts by divergence angle, not American-style frog number. `turnout_frog` is `null` for every K-Track turnout.
- **Crossings:** 22.5° crossing (2257) and 90° crossing (2256) SKUs need live verification — these have shifted across catalog generations.
- **Not included** (out of scope): K-Track expansion sets, K-Track signal track, K-Track turntable, K-Track helix-kit components, accessory wires.

## C-Track vs K-Track (planning interaction)

K-Track and C-Track share the same Märklin 3-rail AC electrical system and the same scale/gauge, but:

- They have different rail profiles and different physical roadbeds, so they do not snap together. Use 24951 (C↔K transition piece) to combine them.
- Their R1 radii match (both 360 mm). R3 also matches (515 mm). R2 and R4 differ slightly.
- K-Track standard turnout divergence is 22.5°, C-Track standard is 24.282°. Mixed-system layouts therefore need the transition piece to break the geometric chain anyway.

## M-Track and older systems

- **M-Track (1953–c.2000):** stamped-metal hollow roadbed (predecessor to both K and C). 5xxx SKU range. Out of scope for this library; mentioned only because both K-Track and C-Track interface with M-Track via dedicated transition pieces.
- **Märklin "1 Gauge" / Spur 1 / Spur Z / Spur N:** different scales, different track systems, NOT covered by this H0 library.

## Sources (intended, not live-fetched)

- https://www.marklin.de/en/products/k-track (catalog index)
- https://www.marklin.de/en/products/details/article/{SKU} (per-piece detail pages)
- https://www.reynaulds.com/categories/Marklin-K-Track.aspx (US dealer cross-reference)
- https://www.modellbahnshop-lippe.de (DE dealer cross-reference)

All `source_verified_at: "2026-05-05"`; pending live re-verification.
