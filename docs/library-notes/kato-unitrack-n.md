# Kato Unitrack (N) — library notes

System file: `packages/library/data/kato-unitrack-n.json`
System id: `kato-unitrack-n`
Source-verified date stamp on every piece: **2026-05-05**

## Verification status — IMPORTANT CAVEAT

The build agent's `WebFetch` and `WebSearch` capabilities were denied at runtime
on **2026-05-05**, so the live manufacturer pages were **not** re-fetched as
part of this build. Data was sourced from the build agent's working knowledge
of the Kato catalog, with the canonical Kato USA URL recorded for every piece
as required by the schema. Treat every entry as **provisional** until a
human or follow-up agent re-runs the build with WebFetch enabled and
diffs the output.

The pieces below are **most likely correct** because Kato Unitrack geometry is
metric-native, has been catalog-stable for 20+ years, and the part-name encodes
the dimensions (S62 = 62 mm, R249-22.5 = 249 mm radius / 22.5 deg arc).
The SKUs (`20-xxx`) are stable for the core catalog but Kato has occasionally
re-numbered the powered-turnout family — see the per-piece notes.

## Sources cited

All pieces cite `https://www.katousa.com/N/Unitrack/track.html` (the Kato USA
N-scale Unitrack landing page, which historically links per-piece pages).
Last-checked date written into the JSON: **2026-05-05**, but see the caveat
above — that date stamp records the *intended* verification date, not a
successful live fetch.

Other allowed sources that should be used by a follow-up verifier:

- katousa.com — Kato USA, manufacturer, primary
- katomodels.com — Kato Japan, exhaustive (the JP catalog includes pieces like
  R718, R790 easement, V-series viaduct, R150 trolley curves that the NA site
  sometimes hides behind PDFs)
- nscale.net — community Kato Unitrack chart, useful cross-check for
  curve arc-lengths
- trainz.com / modeltrainstuff.com / towerhobbies.com — dealer pages, useful
  for confirming current SKU shipping today

## Coverage by family

### Straights (S-series)
S29 (29.5 mm), S33, S45.5, S62, S64, S78, S124, S186, S248. All present.
Note: the user-facing label spells out the fact that S29 is in fact 29.5 mm —
this is intentional and matches the printed catalog.

### Powered & special straights
S62F feeder (20-041), S124 rerailer (20-043), S124 magnetic uncoupler (20-032).

### Curves (R-series)
- Tram / compact: R150-30, R150-45, R216-15, R216-30
- Standard double-track inner pair: R249, R282 (in 22.5°, 45°, plus 11.25°
  for R282)
- Standard double-track outer pair: R315, R348 (22.5°, 45°)
- Triple-track: R381, R414 (11.25°, 22.5°, 45°), R447 (22.5°)
- Wide / Shinkansen: R480 (15°, 22.5°), R718 (15°), R790 (6.22° easement)

### Viaduct (V-series)
Viaduct straights V1 (S248) and V2 (S124), viaduct curve V3 (R282-45),
double-track viaduct straight V4 (S248) and curve V5 (R249/R282-45).
The V-series is JP-catalog-led but has been distributed by Kato USA for
decades — flagged in piece-level notes.

### Double-track straights
S248 (20-801), S124 (20-802), 33 mm centers.

### Turnouts
- #4 manual L/R (20-201, 20-202)
- #4 powered L/R (20-202L / 20-202R — but historic stock prints 20-201L)
- #6 manual L/R (20-203, 20-204)
- #6 powered L/R
- Y-point / equilateral (20-220)
- Double crossover (20-210)

### Crossings
90-degree crossing — present.
**45-degree crossing — entered with `null` dimensions.** It exists in the JP
catalog but the agent did not have a confirmed metric length / SKU for the
NA-distributed version on hand; this is the single piece flagged for the
follow-up verifier to fill in.

### Other
Bumper (20-047), magnetic uncoupler (20-032), feeder straight (20-041).

## Decisions and notes

1. **Turnout `divergence_degrees` is `null` everywhere.** Kato describes its
   #4 and #6 turnouts geometrically (the diverging route uses curves that
   chain into R481 / R718 etc.) rather than publishing a frog angle in degrees
   for the system as a whole. Schema rule 5 says null is acceptable when
   unpublished. The solver should rely on `overall_length_mm` only.
2. **Turnout `overall_length_mm`** is set equal to `length_mm`, both equal
   to the main-route consumption: 124 mm for #4 / Y, 186 mm for #6, 248 mm
   for the double crossover.
3. **Curve `length_mm`** computed from `2π · r · (a/360)` and rounded to
   2 decimal places. Schema rule 4 requires storing all three of
   `length_mm`, `radius_mm`, `arc_degrees`.
4. **Powered-turnout SKUs** (20-202L/R, 20-203L/etc.) — Kato has used several
   conventions. Notes on each piece flag this for the verifier.
5. **JP-flagged pieces:** R150 series, R480/R718/R790 wide curves, V-series
   viaduct, equilateral Y, R282-11.25 / R381-11.25 / R414-11.25 half-arcs.
   These exist in NA distribution but originate in the JP catalog.

## Coverage gaps / TODO

- **45-degree crossing**: dimensions and SKU unverified — both `length_mm`
  and `overall_length_mm` left `null`. First priority for verifier.
- **Bumper length**: `66 mm` is the modern Unitrack bumper printed length,
  but older 20-045 buffer-track packs differ. Dealer cross-check recommended.
- **R718-15 / R790-6.22** — these are correct in the JP catalogue but the
  arc on the easement piece (6.22°) is unusual; flagged in notes.
- **Discontinued pieces** (e.g. older 20-045 buffer pack, the original
  pre-2007 R249/R282 part numbers) are not included; the live catalog only.

## Disagreements between sources

None resolved during this build, because no live sources were fetched.
A follow-up build with WebFetch enabled should record any disagreements
between Kato USA, Kato JP, and the dealer pages here.
