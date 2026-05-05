# Bachmann E-Z Track (N) — library notes

## Verification status

**Important caveat:** as with the HO sibling file, the WebFetch and WebSearch tools were unavailable in this build pass — every attempt to reach the whitelisted manufacturer and dealer domains was denied by the harness. **No piece in this file has been live-verified** and every `source_verified_at` is `null`. The geometry is built from Bachmann's long-standing published N E-Z Track catalogue; SKUs are deliberately left `null` because dealer listings disagree more often for the smaller N range than for HO.

When WebFetch is restored, the verification pass should:

1. Open `https://www.bachmanntrains.com/home-usa/track.php` and walk every N-scale E-Z Track product.
2. Cross-check each SKU and length at Walthers, Trainz, Tower Hobbies and ModelTrainStuff.
3. Update `source_verified_at` to the verification date for any confirmed piece.

## What is asserted

### Geometry (high confidence)

- 5″ straight = **127.0 mm** (`5 × 25.4`)
- 2.5″ straight = **63.5 mm**
- 1.25″ fitter = **31.75 mm**
- 11.25″ R curve, **22.5°**, 16 sections per circle: r = 285.75 mm, arc = 112.205 mm
- 11.4″ R curve, **22.5°**: r = 289.56 mm, arc = 113.701 mm

### SKUs (low confidence — all set to `null`)

Every N-scale SKU is `null` in this pass. The N E-Z Track catalogue is small enough that dealer listings reuse Bachmann numbers inconsistently, and a wrong SKU is far more harmful than a missing one (per the schema's hard rule: "empty is honest, wrong is fatal").

### Turnouts

Bachmann does not publish a frog number, overall length, or divergence angle for its N E-Z Track turnouts on the canonical product page. Every turnout-specific dimensional field (`length_mm`, `overall_length_mm`, `turnout_frog`, `divergence_degrees`) is left `null`. The solver will need to treat these as opaque pieces with no metric contribution until live-verify supplies the values.

## Coverage decisions

- **Single rail material.** Only nickel silver. Bachmann does not currently produce a steel-rail N E-Z Track line.
- **11.25″ vs 11.4″ radius.** Both included as instructed by the task scope. These are very close numerically and may be the same physical section described two ways across catalogue editions; this needs reconciliation at live-verify time. Flagged in the JSON's `notes` field on the 11.4″ curve.
- **Wide-radius N curves.** Bachmann has at times offered larger N radii (e.g. 19″ R) for more recent EZ Command-compatible sets. Not included in this scaffold — would be added after live-verify confirms current production status.
- **Discontinued pieces.** Older Bachmann N E-Z Track pieces from the 1990s/2000s carry distinct SKUs that often surface in inherited inventories; none are included here, but the verification pass should consider tagging the most common ones.
- **Crossings.** Bachmann's N E-Z Track range does not currently include a sectional crossing piece in standard production; intentionally omitted.
- **Bumpers and rerailers.** Included as scaffold entries; SKUs `null`.

## Open questions for the verification pass

1. Resolve the 11.25″ vs 11.4″ radius question: are these two genuinely distinct sections in current production, or one section described two ways?
2. Confirm SKU and length for the 5″ straight, and confirm whether a 2.5″ straight and 1.25″ fitter are still in current production (post-2020) or have been quietly dropped.
3. Confirm whether Bachmann's N turnout has a published frog number / divergence; if so, populate the relevant fields.
4. Confirm whether a wider N radius (e.g. 19″ R) is currently offered and should be added.
5. Confirm rerailer/terminal SKU; the N range historically had a single dual-purpose piece.

## Sources used (intended; not actually fetched in this pass)

- `https://www.bachmanntrains.com/home-usa/track.php` (manufacturer canonical track page)
- `https://www.walthers.com/`
- `https://www.trainz.com/`
- `https://www.towerhobbies.com/`
- `https://www.modeltrainstuff.com/`

## File facts

- File: `packages/library/data/bachmann-ez-track-n.json`
- Pieces: 11 (3 straights/fitters, 2 curves, 4 turnouts, 1 rerailer, 1 bumper)
- All `source_verified_at`: `null` (see verification status above).
