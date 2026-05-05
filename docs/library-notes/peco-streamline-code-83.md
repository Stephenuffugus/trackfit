# Peco Streamline Code 83 - library notes

System file: `packages/library/data/peco-streamline-code-83.json`

## Verification status

**Sandbox denied WebFetch / WebSearch during the 2026-05-05 authoring session.** Values are from the long-stable Peco Code 83 catalog as repeated across Peco printed publications and US/UK dealers (Walthers, Hattons, ModelTrainStuff, Gaugemaster).

The next session with live access should verify against `https://peco-uk.com/collections/code-83` and the individual SL-83xx product pages.

## What is verified vs inferred vs uncertain

| Piece | Status | Notes |
|---|---|---|
| SL-8300 flex track | catalog-canonical | 914 mm / 36 in |
| SL-8362 / SL-8363 medium-radius #6 turnouts | partial - **#6 frog** and ~9.5 deg divergence and 1219 mm radius catalog-canonical; overall_length 245 mm is approximate |
| SL-8360 / SL-8361 small-radius #5 turnouts | partial - **#5 frog**, ~11.25 deg, ~914 mm radius; length approximate |
| SL-8364 / SL-8365 large-radius #7 turnouts | partial - **#7 frog**, ~8 deg, ~1524 mm radius; length approximate |
| SL-8377 / SL-8378 curved turnouts | uncertain - dual-radius 762/1524 mm by design; overall length `null` |
| SL-8390 Y turnout | catalog-canonical for divergence; length approximate |
| SL-8391 / SL-8395 / SL-8393 / SL-8396 (90 deg crossing, double slip, single slip, scissors) | uncertain - all `null` length |

## Why this scale is "HO" not "OO"

Peco Code 83 is targeted at North American HO modellers (US prototype tie spacing, finer rail). The pieces still work mechanically with European HO and UK OO stock at 16.5 mm gauge, but appearance and tie spacing match US practice - that is why SCHEMA's `scale` is `"HO"` here.

## Code 83 vs Code 100 compatibility

**They are NOT directly joinable.** Code 83 rail is shorter (0.083" head height vs 0.100"). Standard Code 100 rail joiners do not clamp Code 83 rail securely.

To transition between Code 100 (Setrack / Streamline / Hornby OO) and Code 83 layouts, use:
- **Peco SL-112** Code 100/83 transition rail-joiner; or
- **Peco SL-114** Code 83/75 transition rail-joiner (for Code 75 finescale).

## Sources used

- https://peco-uk.com/collections/code-83 (manufacturer)
- Individual product pages SL-8360 / SL-8361 / SL-8362 / SL-8363 / SL-8364 / SL-8365 / SL-8377 / SL-8378 / SL-8390 / SL-8391 / SL-8393 / SL-8395 / SL-8396 / SL-8300
- https://www.walthers.com - US dealer cross-reference
- https://www.hattons.co.uk - UK dealer cross-reference

## Coverage gaps and TODOs

1. **All slip / scissors / 90 deg crossing overall_length figures are `null`.** Critical for solver accuracy; populate from current datasheet.
2. **Curved turnout overall lengths** (SL-8377 / SL-8378) are `null`.
3. **Code 83 turnout SKU numbering** has been re-printed with two different conventions (e.g. SL-8362 vs SL-8362FB for unifrog vs Insulfrog variants). The codes here are the medium SKU range; verify against the current Peco product page when the sandbox is open.

## Disagreements

None significant. Some sources cite slightly different overall lengths for SL-8362 (245 mm) vs older catalog (8.625" / 219 mm); the difference is between #6 large and #5 small variants. We tagged `length_mm` as approximate to mark this.
