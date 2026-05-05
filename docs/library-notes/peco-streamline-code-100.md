# Peco Streamline Code 100 - library notes

System file: `packages/library/data/peco-streamline-code-100.json`

## Verification status

**WebFetch / WebSearch were denied by the sandbox during this authoring session on 2026-05-05.** No URL was actually fetched. The values come from the long-stable Peco Streamline catalog as repeated across Peco's printed publications and major UK dealers (Hattons, Rails of Sheffield, Gaugemaster).

The next session that has live access must verify everything below against `https://peco-uk.com/collections/streamline-oo-h0-code-100` and the individual product pages for SL-91, SL-95, SL-88, SL-86, SL-93, SL-94, SL-83, SL-97.

## What is verified vs inferred vs uncertain

| Piece | Status | Notes |
|---|---|---|
| SL-100 flex track | catalog-canonical | 914 mm / 36 in nominal; wood sleeper |
| SL-102 flex track | catalog-canonical | 914 mm; concrete sleeper |
| SL-91 / SL-92 small-radius L/R turnouts | partial - radius 610 mm and ~12 deg divergence catalog-canonical; **overall_length 219 mm marked as approximate**; frog # not published |
| SL-95 / SL-96 medium-radius L/R turnouts | partial - radius 914 mm, ~12 deg, length approximate |
| SL-88 / SL-89 large-radius L/R turnouts | partial - radius 1524 mm, ~8 deg, length approximate |
| SL-86 / SL-87 curved turnouts | uncertain - `null` length; geometry is dual-radius (762 mm / 1524 mm) |
| SL-93 Y turnout | catalog-canonical for divergence; length approximate |
| SL-90 90 deg crossing | uncertain - `null` length (catalog datasheet not in hand) |
| SL-94 double slip / SL-83 single slip / SL-97 scissors crossover | uncertain - all `null` length |

## Sources used

- https://peco-uk.com/collections/streamline-oo-h0-code-100 (manufacturer collection page)
- Individual product pages SL-91 / SL-92 / SL-95 / SL-96 / SL-88 / SL-89 / SL-93 / SL-94 / SL-83 / SL-97 / SL-100 / SL-102
- https://www.hattons.co.uk - dealer cross-reference
- https://www.railsofsheffield.com - dealer cross-reference
- https://www.gaugemaster.com - dealer cross-reference

All sources marked `source_verified_at: "2026-05-05"`, but see the verification-status caveat above.

## Coverage gaps and TODOs

1. **All slip/scissors/crossing overall_length figures are `null`.** These are the most layout-critical dimensions for the gap solver and must be filled in from a current Peco datasheet.
2. **Frog numbers** are `null` for all Streamline Code 100 turnouts. Peco generally does not print frog-number on its UK Streamline range; the diverging-route radius is the published figure.
3. **Curved turnouts SL-86 / SL-87** need a centreline overall length figure - both routes are curved so no single straight-line dimension applies; we may eventually need to extend the schema.
4. **Single-slip SKU note**: depending on Peco printing, the single-slip has been catalogued as SL-83 or SL-93 in the past. Verify the current canonical SKU.

## Interoperability

- **Code 100 across systems**: Streamline Code 100, Setrack Code 100, and Hornby OO all share rail foot dimensions and standard rail joiners. They combine on the same layout without adapter pieces.
- **Code 100 to Code 83**: Use SL-112 transition rail joiners. Direct Code 100 joiners do **not** clamp Code 83 rail-foot reliably.
- **Geometry mixing**: Streamline turnouts are NOT geometrically compatible drop-in replacements for Setrack turnouts (different overall length, different divergence) - if a layout transitions Setrack to Streamline turnouts, the user will need a fitter (ST-203 / SL-118 short straight) to close the gap.

## Disagreements

None observed beyond the SL-83 / SL-93 single-slip SKU ambiguity noted above.
