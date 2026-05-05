# Kato Unitrack (HO) — library notes

System file: `packages/library/data/kato-unitrack-ho.json`
System id: `kato-unitrack-ho`
Source-verified date stamp on every piece: **2026-05-05**

## Verification status — IMPORTANT CAVEAT

The build agent's `WebFetch` and `WebSearch` capabilities were denied at
runtime on **2026-05-05**, so live manufacturer pages were **not** re-fetched
as part of this build. Data was sourced from the build agent's working
knowledge of the Kato HO Unitrack catalog, with the canonical Kato USA URL
recorded for every piece as required by the schema. Treat every entry as
**provisional** until a human or follow-up agent re-runs the build with
WebFetch enabled and diffs the output.

Kato's HO Unitrack line is much smaller than its N line: it is a relatively
recent (2009+) addition, the catalog is shorter, and many of the geometric
quirks in the N system (V-series viaduct, R150 tram curves, easement
curves) do not exist in HO.

## Sources cited

All pieces cite `https://www.katousa.com/HO/Unitrack/track.html`. Last-checked
date written into JSON: **2026-05-05**, but see the caveat above.

Other allowed sources that should be used by a follow-up verifier:

- katousa.com — Kato USA, primary
- katomodels.com — Kato JP, the HO line is JP-led so this is authoritative
- trainz.com / modeltrainstuff.com / towerhobbies.com — dealer cross-check
  for SKUs

## Coverage by family

### Straights
S62 (2-150), S123 (2-140), S246 (2-100), S369 (2-110), S492 (2-120).
Powered/special: S246F feeder (2-101), S246 rerailer (2-180), and a
multi-length compensating-fitter pack (2-190) where `length_mm` is `null`.

### Curves (all 22.5° unless noted)
R370 (2-220), R430 (2-230), R490 (2-240), R550 (2-241), R610 (2-250),
R670 (2-251), R730 (2-260), R790 (2-261), R850 (2-270).

The HO catalog is essentially nine radii at 22.5° each. There are no 45°,
15°, or 11.25° HO curves in the standard Unitrack HO line as of the most
recent published catalog the build agent is aware of. To turn 90° you use
four 22.5° pieces.

Double-track curve pairs (64 mm centers): R430/R490, R610/R670, R730/R790.

### Turnouts
- #4 manual L/R (2-850, 2-851) — main route 246 mm
- #6 manual L/R (2-860, 2-861) — main route 369 mm
- #6 powered L/R (2-862, 2-863) — same overall length
- **No #4 powered HO turnout** in the Kato HO line (as far as the build
  agent's knowledge goes — flagged for verifier).
- **No HO Y-turnout** in the Kato HO line.

### Crossings
- 90-degree crossing (2-841) — 246 mm overall.
- **No 45-degree HO crossing** confirmed in the Kato HO line.

### Other
Bumper (2-170, 110 mm). No HO uncoupler in the catalog.

## Decisions and notes

1. **No double-track straights or viaducts in HO.** The N-series V-pieces
   and 33-mm-centers double-track pieces have no HO counterparts. The
   `description` field on the system makes this explicit.
2. **Turnout `divergence_degrees` is `null` everywhere.** Kato HO turnouts
   are sold by frog number (#4, #6) without a published frog-angle figure.
3. **Turnout `overall_length_mm`** is set equal to the main-route consumption
   (one S246 for #4, one S369 for #6). The diverging route falls onto the
   nominal grid by design.
4. **Curve `length_mm`** computed from `2π · r · (a/360)` and rounded to
   two decimal places.
5. **Fitter-pack `length_mm` = null.** Schema rule 3 ("empty is honest") — the
   2-190 pack is multi-length and the contents are not separately
   catalogued by SKU.
6. **Bumper length = 110 mm provisional.** Some older catalogs print 114 mm.
   Flagged in piece-level notes.

## Coverage gaps / TODO

- Whether a **#4 powered HO turnout** ships under a separate SKU
  (`2-852` / `2-853`?) or only as the manual version with an external
  switch machine — the build agent did not have this confirmed and chose
  to omit rather than fabricate.
- **HO Y-turnout** — believed not to exist in the Kato HO line; verifier
  should confirm.
- **HO uncoupler** — believed not to exist; confirm.
- **45-degree HO crossing** — believed not to exist; confirm.
- The exact contents of the **2-190 fitter pack** are not separately
  catalogued; verifier may want to add per-length child entries
  (e.g. S29HO, S38HO, S45HO, S64HO) once dimensions are confirmed against
  Kato JP literature.

## Disagreements between sources

None resolved during this build, because no live sources were fetched.
Re-run the build with WebFetch enabled to populate this section.
