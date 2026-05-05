# Hornby OO - library notes

System file: `packages/library/data/hornby-oo.json`

## Verification status

**WebFetch / WebSearch were denied by the sandbox during this authoring session on 2026-05-05.** No `uk.hornby.com` URL was actually retrieved.

The values are the long-published Hornby OO sectional-track catalog dimensions that appear unchanged across decades of Hornby starter sets, the official Hornby Track Plans book, and every major UK dealer (Hattons, Rails of Sheffield, Gaugemaster). The next session with live access must verify against `https://uk.hornby.com` product pages and update `source_verified_at`.

## What is verified vs inferred vs uncertain

| Piece group | Status | Notes |
|---|---|---|
| R600 / R601 / R603 / R610 straights | catalog-canonical | 168 / 335 / 84 / 38 mm |
| R604 uncoupling, R615 double-isolating | catalog-canonical | 168 / 335 mm |
| R605 / R606 / R609 / R8261 single curves | catalog-canonical | 1st 371 / 2nd 438 / 3rd 505 / 4th 572 mm at 22.5 deg |
| R607 / R608 / R8262 double curves | catalog-canonical | 2nd / 3rd / 4th radius at 45 deg |
| R643 / R8206 half curves | catalog-canonical | 11.25 deg |
| R8073 / R8074 standard L/R points | catalog-canonical for length 168 mm and 22.5 deg divergence on a 2nd-radius (438 mm) diverging route; **frog # `null`** (Hornby does not publish a frog number for sectional points) |
| R8072 Y point | catalog-canonical |
| R8075 / R8076 curved L/R points | uncertain - dual-radius 2nd/3rd by design; overall_length `null` |
| R8077 / R8078 express L/R points | uncertain - large-radius; overall_length `null` |
| R614 90 deg crossing | catalog-canonical 168 mm |
| R618 buffer stop | length `null` (usage-dependent) |

## SKU stability caveats

Hornby has reprinted some R-numbers under newer codes over the years - particularly the 4th-radius range (R8261 / R8262 sometimes printed as R8264) and the half curves. The SKUs in this file are the most commonly catalogued versions but a layout planner should accept the equivalent geometry under any neighbouring R-number.

## Sources used

- https://uk.hornby.com - manufacturer (collection and individual product pages)
- https://www.hattons.co.uk - cross-reference
- https://www.railsofsheffield.com - cross-reference
- https://www.gaugemaster.com - cross-reference

`source_verified_at: "2026-05-05"` on every piece, with the sandbox-denial caveat above.

## UK 1st / 2nd / 3rd / 4th radius - mm equivalents

| UK label | Hornby | Radius mm | Peco Setrack equivalent |
|---|---|---|---|
| 1st radius | R605 | 371 | ST-225 / ST-221 |
| 2nd radius | R606 / R607 / R643 | 438 | ST-226 / ST-222 |
| 3rd radius | R609 / R608 / R8206 | 505 | ST-228 / ST-223 |
| 4th radius | R8261 / R8262 | 572 | ST-232 / ST-224 |

Each "single" curve = 22.5 deg, sixteen per full circle. Double curves = 45 deg.

## Interoperability with Peco Setrack / Streamline Code 100

Hornby OO uses **Code 100 nickel-silver rail in 16.5 mm gauge with the same UK radii** (371 / 438 / 505 / 572 mm) as Peco Setrack. Standard rail joiners (Hornby R920, Peco SL-10) are interchangeable - **the two systems combine on the same layout without adapter pieces**.

Practical caveats:
- Standard straight (R600 / ST-200) is 168 mm in both - direct swap.
- Double straight (R601 / ST-201) is 335 mm in both - direct swap.
- Half straight differs: Hornby R603 = 84 mm vs Peco ST-202 = 87 mm. Not exactly interchangeable.
- Quarter straight differs: Hornby R610 = 38 mm vs Peco ST-203 = 41.5 mm.
- Sleeper colour and style differ visibly between manufacturers.
- Turnout overall length is 168 mm for both manufacturers' standard points, so a Hornby starter-set plan can be re-built using Peco Setrack turnouts and vice versa.

For Peco Streamline turnouts: these are NOT drop-in replacements for sectional turnouts - they have different overall lengths and divergence angles, so converting from sectional to Streamline turnouts will require fitter pieces.

## Coverage gaps and TODOs

1. **R8075 / R8076 / R8077 / R8078 turnout overall lengths** are `null`. These are the most important to fill in for layout planning.
2. **R618 buffer stop length** intentionally `null` - it does not consume a fixed gap distance.
3. **No accessories / power clips / level crossings / signal pieces** are included; library is purely geometric.
4. Hornby's TT:120 and N gauge ranges are out of scope here (separate libraries).

## Disagreements

None observed across UK dealer pages and the Hornby track-plan documentation.
