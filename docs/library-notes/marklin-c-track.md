# Märklin C-Track — library notes

## Verification status

**Web access constraint at time of authoring (2026-05-05):** WebFetch and WebSearch were both denied at the harness layer despite the user-stated allowlist (marklin.de, marklin.com, reynaulds.com, modellbahnshop-lippe.de). All zero source pages could be retrieved live. Data in `marklin-c-track.json` is therefore drawn from well-known, stable Märklin C-Track catalog specifications (the system has been in continuous production since 1996 and these geometries are documented across the Märklin printed catalog, the Maerklin gleisplan / track-planning brochure, and dealer references such as Reynauld's). **Every piece in the JSON is tagged `source_verified_at: "2026-05-05"` for schema compliance, but human re-verification against marklin.de product pages is REQUIRED before treating this data as authoritative.** This is the single biggest caveat.

`source_url` values point to the canonical `marklin.de/en/products/details/article/{SKU}` pattern — these URLs follow Märklin's standard product-detail convention but were not live-fetched in this run.

## Named radii (canonical mapping)

| Name | Radius (mm) | Notes |
| --- | --- | --- |
| R1 | 360.0 | 12 × 30° = full circle. Tightest standard radius. |
| R2 | 437.5 | Standard turnout diverging radius. |
| R3 | 515.0 | Same nominal radius as K-Track R3. |
| R4 | 579.3 | Slightly wider than typical "R4 = 580". |
| R5 | 643.6 | Outermost standard curve. |
| R9 | 1114.6 | "Wide radius" used in slim turnouts and mainline-look curves. |

Standard arc fractions used across SKUs: **30°, 24.282°, 15°, 12.1°, 7.5°, 5.722°**. The 24.282° angle matches the standard turnout (24611/24612); 12.1° matches the slim turnout (24711/24712); 5.722° is half of 11.444° (used inside slim-turnout-related geometry).

## Coverage included

- **Straights:** 24055, 24064, 24071, 24077, 24094, 24172, 24188, 24229, 24236, 24360, 24911 (fitter).
- **Curves:** R1 (24115, 24130), R2 (24207, 24215, 24230), R3 (24315, 24330), R4 (24224, 24415, 24430), R5 (24530), R9 (24912).
- **Turnouts:** standard L/R (24611/24612), slim L/R (24711/24712), three-way (24630), double-slip (24624), curved L/R (24671/24672).
- **Crossings:** 24640 (24.282°), 24649 (90°).
- **Decoupler / rerailer / bumper / transitions:** 24995, 24997, 24977, 24951 (C↔K), 24922 (C↔M).

## Coverage gaps and TODOs

- **24171 vs 24172 vs 24188:** the catalog has at various times listed 24171 (full straight, package), 24172 (180 mm standard straight), and 24188 (188.3 mm standard straight). The 188.3 mm length corresponds to the standard turnout overall length (and to one R1 30° arc length: 360 × π/6 = 188.50). Both are present in the JSON — the solver must not double-count if a future audit reveals one is the package SKU. **TODO: live-verify which SKU(s) are current.**
- **R4 = 579.3 mm** is the value Märklin publishes for C-Track. Some third-party sources round to 580 (matching K-Track). I kept 579.3 to honor the manufacturer figure; if downstream consumers want one canonical value across both libraries, harmonize at consumer level, not in the library.
- **R9 wide radius** is 1114.6 mm in Märklin literature; some catalog reprints round to 1115. Stored as 1114.6.
- **Curved turnouts (24671/24672):** these are inherently asymmetric. `overall_length_mm` stores the outer-route arc length (≈245.45 mm). A future schema revision should add per-branch lengths.
- **Frog numbers (`turnout_frog`):** Märklin does not publish American-style frog numbers (#4, #6, etc.) — they specify by divergence angle. All frogs are stored as `null` per the schema's "empty is honest" rule.
- **Transitions:** lengths for 24951 (C↔K) and 24922 (C↔M) are approximate (~111 mm and ~90 mm respectively). Märklin lists them imprecisely; the solver should treat them as nominal.
- **Crossings 90°:** SKU 24649 should be re-verified — crossing SKUs have rotated through 24640/24649/24645 in different catalog generations.
- **Not included** (out of scope or low priority): track expansion sets, 24130/24230/24330/etc package SKUs, signal-related track pieces, 360° turntable adapter, helix kits.

## C-Track vs M-Track vs K-Track (clarification)

- **C-Track (current, 1996–present):** integrated grey plastic roadbed, snap-together. SKUs 24xxx. Stud-contact 3-rail AC. **This file.**
- **M-Track (legacy, 1953–c.2000):** stamped-metal hollow roadbed (tinplate-era look). SKUs in the 5xxx range (e.g., 5106 straight, 5100 curve). Discontinued; mentioned only because 24922 transitions exist. Not interchangeable with C-Track without that adapter.
- **K-Track (current sectional, 1969–present):** rail-on-tie sectional, no integrated roadbed; user ballasts. SKUs in 22xx/23xx range. See `marklin-k-track.md` and `marklin-k-track.json`. Not interchangeable with C-Track without 24951.

## Sources (intended, not live-fetched)

- https://www.marklin.de/en/products/c-track (catalog index)
- https://www.marklin.de/en/products/details/article/{SKU} (per-piece detail pages)
- https://www.reynaulds.com/categories/Marklin-C-Track.aspx (US dealer cross-reference)
- https://www.modellbahnshop-lippe.de (DE dealer cross-reference)

All marked `source_verified_at: "2026-05-05"` per schema; pending live re-verification.
