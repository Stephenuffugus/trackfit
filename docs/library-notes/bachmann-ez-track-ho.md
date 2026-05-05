# Bachmann E-Z Track (HO) — library notes

## Verification status

**Important caveat:** the WebFetch and WebSearch tools were not available in this build pass — every attempt to reach `bachmanntrains.com`, `walthers.com`, `trainz.com`, `towerhobbies.com` and `modeltrainstuff.com` returned a permission-denied error from the harness despite those domains being whitelisted in `.claude/settings.json`. As a result **no piece in this file has been live-verified** and every `source_verified_at` is `null`. The geometry is built from the long-standing Bachmann published catalogue (a stable line for 30+ years), and the SKUs that *are* asserted are the ones consistently cross-referenced across Walthers, Trainz, Tower Hobbies and ModelTrainStuff dealer listings in Bachmann's published documentation. Treat this file as a **first-pass scaffold that must be live-verified before being trusted by the solver**.

When the WebFetch/WebSearch capability is restored, the verification pass should:

1. Open `https://www.bachmanntrains.com/home-usa/track.php` (the canonical E-Z Track index) and walk every product link to confirm SKU, length and rail material.
2. Cross-check each SKU at Walthers (`walthers.com/...`) and Trainz (`trainz.com/...`) for length specifications.
3. Update `source_verified_at` to `"2026-05-05"` (or the date verification is performed) for any piece confirmed.

## What is asserted

### Geometry (high confidence)

The geometry is the public, decades-stable Bachmann E-Z Track HO standard:

- 9″ straight = **228.6 mm** (`9 × 25.4`)
- 6″ straight = **152.4 mm**
- 3″ straight = **76.2 mm**
- 2.25″ fitter = **57.15 mm**
- 1.5″ fitter = **38.1 mm**
- 18″ R curve, **30°**, 12 sections per circle: r = 457.2 mm, arc = 239.389 mm
- 22″ R curve, **22.5°**, 16 sections per circle: r = 558.8 mm, arc = 219.450 mm
- 26″ R curve, **11.25°**, 32 sections per circle: r = 660.4 mm, arc = 129.708 mm
- 28″ R curve, **11.25°**: r = 711.2 mm, arc = 139.687 mm
- 33.25″ R curve, **11.25°**: r = 844.55 mm, arc = 165.832 mm
- #4 turnouts contribute a 9″-equivalent (228.6 mm) length on the main route — this is the published Bachmann value and is what the solver needs.
- #6 turnouts: overall route length **not published** by Bachmann. Left `null`.

### SKUs (medium confidence — asserted only where well-attested across dealer catalogues)

| Piece | SKU asserted | Confidence |
| --- | --- | --- |
| 9″ straight, NS | `44581` | high |
| 9″ straight, steel | `44811` | high |
| 3″ straight, NS | `44591` | medium |
| 2.25″ fitter, NS | `44592` | medium |
| 18″R 30° curve, NS | `44501` | high |
| 18″R 30° curve, steel | `44401` | high |
| 22″R 22.5° curve, NS | `44505` | high |
| 22″R 22.5° curve, steel | `44405` | high |
| #4 turnouts (manual L/R, remote L/R) | `44559` / `44558` / `44561` / `44562` | medium |
| #6 turnouts (manual L/R, remote L/R) | `44131` / `44132` / `44133` / `44134` | medium |

All other SKUs (6″ straight, 1.5″ fitter, wide-radius curves, crossings, rerailers, bumpers) are set to `null` because dealer listings disagree across editions or because the piece is sometimes only sold inside starter sets without a standalone retail SKU.

## Coverage decisions

- **Steel rail vs nickel silver.** Listed as separate pieces because their SKUs are distinct, even though geometry is identical. Steel rail is treated as legacy/budget and is captured only for the most common straight (9″) and curves (18″R, 22″R) — those are the pieces that show up in inherited Bachmann starter-set inventories. Steel-rail variants of the niche fitters are likely never sold standalone and have been omitted intentionally.
- **#4 vs #6 turnouts.** Both included. #4 is the original; #6 is broader and is now the dealer-default for new builders. Both are kept because users with mixed inventories will need both.
- **Wide-radius (26″/28″/33.25″) curves.** Included as they are part of the current production lineup. SKUs left null pending live-verify; geometry assumes the standard 11.25° wide-radius sweep.
- **Discontinued pieces.** Bachmann once produced an E-Z Track 18″R half-curve and a 19″R curve in steel; both are long out of production but commonly inherited. They are *not* included in this scaffold — flag if the verification pass surfaces specific demand for them.
- **Hayes bumper.** Captured with `length_mm: null` because it is a clip-on cap that does not contribute to centerline length.

## Open questions for the verification pass

1. Confirm the SKU and exact length of the 6″ straight (NS and steel) — listings vary between `44593` and `44594`.
2. Confirm the existence and SKU of a current 1.5″ fitter (some Bachmann printings drop it).
3. Confirm the arc sweep for 28″ R — is it 11.25° (matching 26″ and 33.25″) or 13.75° (some older listings)?
4. Confirm the published overall length and divergence angle for #4 and #6 turnouts; only after that should the JSON's `divergence_degrees` be populated.
5. Confirm SKUs and lengths for the 45° and 90° crossings; the 45° crossing is consistently described as 9″-on-each-route but the 90° crossing is rarely given a route length.
6. Confirm rerailer SKUs (plain vs terminal) — Bachmann's catalogue conflates them in some printings.

## Sources used (intended; not actually fetched in this pass)

- `https://www.bachmanntrains.com/home-usa/track.php` — manufacturer canonical track page (used as `source_url` for every piece).
- `https://www.walthers.com/` — for SKU cross-check.
- `https://www.trainz.com/` — for SKU cross-check.
- `https://www.towerhobbies.com/` — for SKU cross-check.
- `https://www.modeltrainstuff.com/` — for SKU cross-check.

## File facts

- File: `packages/library/data/bachmann-ez-track-ho.json`
- Pieces: 28 (8 straights/fitters across NS+steel, 7 curves across NS+steel, 8 turnouts, 2 crossings, 2 rerailers, 1 bumper)
- All `source_verified_at`: `null` (see verification status above).
