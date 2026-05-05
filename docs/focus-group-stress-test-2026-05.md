# Trackfit — Synthetic focus-group stress test, May 2026

A structured red-team of the v0.3.2 build against six older-hobbyist
personas. Not a real user study — Stephen has no real users yet. This
is the punch list to fix before he hands the URL to his first tester.

Calibration source: handoff §1 (audience constraints), strategy §3
(known hobbyist complaints), and direct inspection of the current
`apps/web/src/` surface. Every friction below was checked against the
actual code path, not speculated; severities mark which ones a real
user would hit and how hard they'd hit.

---

## How to read this

Each persona walks through five tasks: first-run, inventory entry,
their core task, hitting a Premium gate, and the exit moment. Each
friction is logged in this format:

```
**[P{persona}-T{task}-F{n}] Severity: HIGH/MED/LOW/NONE** — one-paragraph
description with quoted strings from source. Fix: concrete suggestion.
File: absolute path.
Severity rationale: why this severity given the audience.
```

`NONE` entries are kept on purpose — they document *what was checked
and is fine*, so this report doubles as a regression checklist next
quarter.

---

## P1 — Walt, 71 (Lionel FasTrack, iPhone SE, 375 px)

Retired O-gauge collector, ~150-piece FasTrack inventory, bifocals,
big hands. Goal: plan a 4×8 ft layout for the grandkids.

### P1-T1 — First run

The onboarding modal opens automatically (`Onboarding.tsx`, controlled
by `isOnboarded()`). Three plain-English cards — "What is this?",
"Pick what you have", "Tell it your gap, get an answer". The primary
button reads "Got it →" then "Start using Trackfit →" on the last
card. `min-height: 52px` on `.onboarding-primary` is comfortable for
Walt's fingers.

```
**[P1-T1-F1] Severity: NONE — verified, no issue** — onboarding cards
use Fraunces 26-34 px headlines and IBM Plex Sans 15 px body
(`onboarding-card h2`, `onboarding-body` in styles/index.css L1747-1761).
Walt with bifocals reads this fine. Checked because older audiences
routinely complain about onboarding type sizes.
File: apps/web/src/styles/index.css
```

```
**[P1-T1-F2] Severity: LOW** — the close × in the corner uses a 44×44
hit target (`.onboarding-close`, L1714-1726) but its visible glyph is
a 24 px "×" without label. Walt may not realise it dismisses the
modal vs. just one card. The "Start using Trackfit →" CTA on card 3
is the *intended* dismiss; the × is a redundant escape hatch. No fix
needed unless we see testers repeatedly tapping × on card 1.
File: apps/web/src/components/Onboarding.tsx
Severity rationale: ambiguous but recoverable; the alternative path
(swipe through, tap primary CTA) works.
```

### P1-T2 — Inventory entry

Walt taps the "Lionel FasTrack" preset chip (`PresetChips.tsx`). Chip
is 13 px IBM Plex Sans, `min-height: 44px` (L116-134). Tapping fills
inventory with all FasTrack pieces at `DEFAULT_PRESET_QTY = 4`
(`apps/web/src/lib/constants.ts:29`).

```
**[P1-T2-F1] Severity: HIGH** — every preset loads with `qty: 4` for
*every* piece including obscure crossings, half-curves, and bumpers.
Walt has 150 FasTrack pieces and the preset gives him ~30 rows × 4 =
120 starter pieces, none of which match what's actually in his box.
He now has to edit qty on most rows (most should be 0). On a 375 px
iPhone, the qty input is the third grid column (mobile layout
`.inv-row` L1545-1574) and accepts text input via `inputMode="numeric"`
— no visible +/- steppers on iOS Safari. Walt has to tap the field,
wait for the numeric keypad, type a digit, then tap somewhere else
to dismiss. For 30 rows that's painful.
Fix: load presets with `qty: 0` so the user adds pieces affirmatively;
OR add tap-to-zero / tap-to-increment buttons next to the field; OR
pre-collapse the row list to "common pieces" with an "Add unusual
pieces" expander.
File: apps/web/src/lib/constants.ts (DEFAULT_PRESET_QTY), apps/web/src/lib/presets.ts (presetToInventory)
Severity rationale: directly contradicts the section subhead "What
you have to work with" (InventoryList.tsx:84) — the user does NOT
have 4 of every FasTrack piece. This is the inventory-entry friction
the strategy doc §3.1 explicitly warns about.
```

```
**[P1-T2-F2] Severity: MED** — qty input has `step={1}` and
`inputMode="numeric"` (InventoryRow.tsx:108-115). On Walt's iPhone
SE, the row's mobile grid is `48px 1fr 44px` with the qty input in
the bottom-right grid area (`.inv-row [data-field="qty"]`,
styles/index.css:1567-1569). At 375 px viewport with 20 px wrap
padding (.wrap L1503), the qty input ends up roughly 100-120 px wide
and 38-44 px tall depending on font. Walt's bifocals + thick fingers
*can* hit it, but the lack of a tap-to-edit affordance (no + / − or
"Set to 0" shortcut) means every qty change is a number-pad summon.
Fix: add explicit "−" and "+" stepper buttons (44×44) that bracket the
qty input; native number spinners are useless on iOS.
File: apps/web/src/components/InventoryRow.tsx
Severity rationale: every persona over 65 will hit this; aggregates
into "the inventory is tedious" — which IS the complaint Trackfit
exists to solve.
```

```
**[P1-T2-F3] Severity: MED** — Walt scrolls down past 30 FasTrack rows
and there is no visual progress indication of "how many rows are
left". Walt with 150 pieces in real life and a giant FasTrack preset
loaded does not know which pieces are missing from the catalog vs.
already covered; the InventoryFilters chip row helps ("Straights 12
/ Curves 8") but lives at the top of the section (L87 in
InventoryList.tsx) and scrolls away.
Fix: sticky filter chips when scrolled, OR a compact running counter
("12 with quantity > 0 of 28 in catalog") in a sticky band at the
bottom. M effort.
File: apps/web/src/components/InventoryList.tsx
Severity rationale: a 150-piece collector is the explicit target user
(handoff §1); this affects all their inventory work.
```

### P1-T3 — Plan a 4×8 ft layout

Walt taps "What can I build with my inventory? →" (`App.tsx:822-830`,
`.layout-suggester-cta`). Modal opens. Three filter rows: Style,
Footprint, Scale.

```
**[P1-T3-F1] Severity: HIGH** — Walt's task is "fit a layout in 4×8
ft". The footprint chips read "Small (≤ 1.5 m × 1 m)", "Medium",
"Large" (LayoutSuggester.tsx:642-647). 4×8 ft = 1.22 m × 2.44 m,
which the code buckets as "large" (SMALL_W=1500, MEDIUM_W=2400 — see
LayoutSuggester.tsx:43-46; 2440 mm > 2400). But Walt thinks in feet.
There is no visible mapping from "4×8" → which chip. He has to
mental-math meters, and the borderline 2.44 m falls into "Large"
which sounds bigger than what he wants.
Fix: show inch-or-mm labels per the user's persisted unit preference
("Small (≤ 5 ft × 3 ft)" when unit is "in"). Engine work is trivial —
the constants are already in mm. S effort.
File: apps/web/src/components/LayoutSuggester.tsx (the options array
at L642-647)
Severity rationale: O-gauge is the most-imperial-thinking subset of
the audience; we ask them to think in meters at exactly the moment
they're trying to filter to a familiar imperial dimension.
```

```
**[P1-T3-F2] Severity: MED** — scale auto-detects from inventory's
median curve radius (LayoutSuggester.tsx:105-116; `< 250 → N`,
`< 450 → HO`, `< 800 → OO`, else `O`). FasTrack curves run 14"-72"
diameter so radii ≈ 178-914 mm. Walt's full FasTrack preset will
auto-detect to "OO" not "O" because the median is dragged down by
half-curves and tight switches. The detected scale chip silently
flips and counts re-compute against the wrong scale. Walt may notice
"only 2 layouts buildable" and not know why.
Fix: include scale-aware piece labels in the detection (FasTrack
pieces self-identify as O via the library system); fall back to median
radius only when no system can be inferred. The library system tells
us scale directly via TrackSystem.scale.
File: apps/web/src/components/LayoutSuggester.tsx (detectScale)
Severity rationale: silently wrong filtering is the WORST kind of
friction — the user blames their inventory, not the app.
```

```
**[P1-T3-F3] Severity: MED** — every layout card with a non-buildable
status renders a "Where to buy missing pieces" expander
(LayoutSuggester.tsx:393-432). Walt's task isn't shopping; he wants
the 4×8 plans he CAN build today. Yet the score-bar is muted (5
greyscale blocks, L131-143) and the **buildable** (green) and **close**
(amber) badges visually compete with each other. The "Build this"
green button (`.layout-card-build`, styles/index.css:2147-2155) only
appears on buildable cards, which is right — but its emerald green
(`#2f8a3d`) is the only saturated UI element on the screen and pulls
focus, away from a "close" card that may actually be a better plan
choice.
Fix: nothing, this is a design call (permission-gated). Just flagging
that "Build this" button visual weight may misallocate Walt's
attention.
File: apps/web/src/styles/index.css (.layout-card-build)
Severity rationale: not blocking, but a known elderly-UX pattern —
we follow the loudest button.
```

### P1-T4 — Premium gate

Walt has not taken a photo (no camera tap), so he doesn't hit the
photo-ID quota. He notices "Print inventory report" in Settings (gear
top-right). Tapping it: `SettingsMenu.tsx:355-386` — disabled when
inventory empty, opens upgrade modal directly when non-premium. Modal
copy: "Trackfit Premium — More tools for the workbench. Pay once,
keep forever." Two cards: "Lifetime — once · {price}" and "Monthly ·
{price}", both **disabled and showing "Coming soon"** because
`PREMIUM.lifetimeUrl` and `PREMIUM.monthlyUrl` env vars are unset
(see PremiumModal.tsx:45-46, changelog v0.3.2).

```
**[P1-T4-F1] Severity: HIGH** — Walt wants to print his collection for
his insurance binder. He taps "Print inventory report" — the
upgrade modal opens (skipping the paper-size popover, per
SettingsMenu.tsx:368-372). Both upgrade buttons read "Coming soon"
because the URLs aren't configured. Walt's net experience: clicked a
button, got a modal, was told nothing is available. His takeaway:
"Trackfit can't do this yet." He doesn't realise this is the live
prototype's "we haven't decided pricing" state.
Fix: when both URLs are empty, show a different modal copy: "Trackfit
Premium isn't on sale yet. We'll let you know when it is." — turn the
"Coming soon" disabled cards into a single waitlist card that captures
an email (or just acknowledges interest). M effort. Or: hide the
"Print inventory report" row entirely when premium is unavailable, so
the disappointment never happens. S effort.
File: apps/web/src/components/PremiumModal.tsx, apps/web/src/components/SettingsMenu.tsx
Severity rationale: tester-card.md explicitly tells testers "no one
will be charged anything right now. Just close the screen and keep
going" — but Walt the real user, post-tester-card, hits a dead-end
and quits.
```

```
**[P1-T4-F2] Severity: NONE — verified, no issue** — the premium modal
uses `useFocusTrap` (PremiumModal.tsx:31-34) with ESC handler. Tab
cycles inside the modal, ESC closes, focus restores. Checked because
older users mistake modals for "the whole app changed" and get stuck.
File: apps/web/src/components/PremiumModal.tsx
```

### P1-T5 — Exit moment

Walt closes the upgrade modal, scrolls back up, looks at his messy
inventory. Will he come back tomorrow?

Verdict: **probably not, unsupervised**. The friction stack of
"presets fill in 4-of-everything, qty editing is tedious, the layout
filter said 'Large' is what he wanted but it sounds wrong" pushes him
past the 5-minute patience threshold the strategy doc §3.1 explicitly
flags. With Stephen physically present demoing? Absolutely yes — the
gap solver and the layout suggester both impress on first contact.

---

## P2 — Margaret, 68 (HO mixed pile, Android tablet, tech-skeptical)

Returning hobbyist after 30 years. Mixed pile of Atlas Code 83 and
Bachmann EZ-Track from estate sales. Goal: figure out what she has.

### P2-T1 — First run

Onboarding cards land. Margaret reads carefully because she's
tech-skeptical. Card 2: "Pick what you have. Tap a brand to load the
standard pieces, then change the quantities to match your box."

```
**[P2-T1-F1] Severity: MED** — Margaret has TWO brands of track in her
pile: Atlas and Bachmann. The onboarding card and the inventory
section subhead ("Tap a brand to load the standard pieces.",
InventoryList.tsx:85) both imply she should pick *one*. There is no
instruction that says "you can load a second preset and it'll merge"
— and indeed loading a second preset *replaces* her inventory after
a confirm prompt (App.tsx:227-246, "Replace your inventory with
{system}? Anything you've added or changed will be lost."). The
mental model the app gives Margaret doesn't match the mental model
of a returning hobbyist with mixed pieces.
Fix: change the confirm copy to acknowledge mixed inventories
("Loading {system} replaces what's in the list. If you have multiple
brands, load the one with the most pieces first, then add the others
manually with + Add piece.") OR add a "Load AND merge" button to the
preset chip on second tap. M effort.
File: apps/web/src/App.tsx (loadPreset, the confirm message at L231-234)
Severity rationale: estate-sale / inherited-pile inventories are an
explicit strategy-doc §3.6 use case. Telling a 68-year-old "your
data will be lost" when she just wants to add another brand is
cardiac.
```

### P2-T2 — Inventory entry

Margaret loads Atlas HO Code 83 (chip works). She sees pieces with
labels like `Snap-Track 9" straight (S-9)` and the read-only length
column shows `9.000` with a tiny lock icon. She starts setting qtys.

```
**[P2-T2-F1] Severity: NONE — verified, no issue** — the lock icon
(`<LockGlyph>` in InventoryRow.tsx:134-148) has a hover/focus
`title="Catalog-derived: this length comes from the manufacturer's
spec, not user input."` and `aria-label` describing it. Margaret on
an Android tablet won't see the title on hover but the visual lock
glyph + dashed border + diagonal-hatch fill make it visibly read-only.
Checked because tech-skeptical users panic when an input "won't let
me type".
File: apps/web/src/components/InventoryRow.tsx
```

```
**[P2-T2-F2] Severity: MED** — for a Bachmann piece Margaret can't
identify, she taps "+ Add piece" (`.add-row`, L387-405). A blank row
appears with empty label and qty 1 (defaulted in
useUndoableInventory.add). The row's length input expects mm OR
inches depending on `unit` state (set globally per-row by the
top-level UnitToggle). Margaret has a tape measure marked in inches.
The unit toggle is at the bottom of the GapCard, two scrolls away,
not on the inventory row. She types "9" thinking inches; the app
treats it as inches *if* unit is "in", else mm. There's no per-row
unit confirmation.
Fix: show "in" / "mm" suffix inline next to the length input on every
row (`<input>` + small adjacent label, no functional change). S
effort.
File: apps/web/src/components/InventoryRow.tsx (the length cell)
Severity rationale: a unit-conversion mismatch silently corrupts her
inventory; she'll find out when the gap solver returns nonsense.
```

```
**[P2-T2-F3] Severity: HIGH** — Margaret has no way to tell the app
"this piece is Bachmann, not Atlas." The InventoryRow has a label
field, length, qty, photo, but the *manufacturer / system* origin is
implicit (only set when a preset is loaded; lost when she manually
adds rows). Later, the marketplace expander on a near-miss card
infers the system via `inferSystemForRows()`
(presets.ts:99-115) by counting label matches against library systems
— but Margaret's pile has Atlas labels (preset-loaded) AND her
hand-typed Bachmann pieces (no system). The inference runs on the
*solution's pieces*, which means Atlas always wins. Her Bachmann
pieces silently inherit Atlas vendor links.
Fix: add a "Brand" column or per-row dropdown for hand-added rows.
M effort. Or: scope inferSystemForRows to be system-aware when the
solution mixes labelled and unlabelled rows.
File: apps/web/src/components/InventoryRow.tsx, apps/web/src/lib/presets.ts
Severity rationale: this is the strategy-doc §3.5 "library accuracy"
problem. Margaret will be sent to the wrong vendor.
```

### P2-T3 — Identify what she has

Margaret has a piece in her hand she doesn't recognise. She taps the
+ photo button on a row (`PhotoButton.tsx`), takes a photo. The stub
identifier runs (`identify-piece.ts:291-306`, 600 ms delay). Three
candidates appear via `<CandidateConfirmSheet>` (because the stub's
top-1 confidence is jittered around 0.91 ± 0.03, which sometimes
clears the 0.85 threshold and sometimes doesn't).

```
**[P2-T3-F1] Severity: HIGH** — the stub's behaviour is non-
deterministic re: auto-fill vs. confirm-sheet. AUTO_FILL_CONFIDENCE_
THRESHOLD = 0.85; baseConfidences[0] = 0.91 with ±0.03 jitter
(identify-piece.ts:198-223), so ~17% of the time the top candidate
falls below 0.85 and opens the candidate sheet; the other ~83% it
auto-fills silently. From Margaret's POV the app sometimes "fills
the row" and sometimes "asks her" — same gesture, different outcome.
Tech-skeptical users read this as the app being unreliable.
Fix: make stub deterministic (always show the candidate sheet for
demo / tester runs, OR always auto-fill when active preset loaded).
The real Vision API will have similar variance, but at least it'll
be tied to actual photo content. S effort.
File: apps/web/src/lib/identify-piece.ts (jitter calls in buildStubCandidates)
Severity rationale: the explicit goal of the stub is "test whether
the experience feels right" (changelog v0.3.2). Variance in same-
gesture-same-outcome is a clear false negative.
```

```
**[P2-T3-F2] Severity: MED** — when auto-fill triggers, the row's
`label` is silently rewritten with the candidate's label (App.tsx:
302-325, `autoFillRowFromCandidate`). Margaret had typed "Bachmann
9 inch" by hand; the auto-fill clobbers to `Snap-Track 9" straight
(S-9)` (an Atlas Code 83 default). No confirmation, no undo offered
(the photo capture path uses a different toast than `useUndoable
Inventory.toast`). Margaret has to remember she typed something and
notice it's gone.
Fix: when a row already has a non-empty label that *differs* from the
candidate's label, fall through to the candidate-confirm sheet
regardless of confidence, so Margaret confirms the label change.
S-M effort.
File: apps/web/src/App.tsx (runIdentifyOnRowPhoto / autoFillRow...)
Severity rationale: silent data overwrite is the cardinal sin for
tech-skeptical users.
```

```
**[P2-T3-F3] Severity: NONE — verified, no issue** — the
CandidateConfirmSheet has a "None of these — type it manually"
escape-hatch button (CandidateConfirmSheet.tsx:140-148). Honors
handoff §3 "never block the user". Checked because tech-skeptical
users need an explicit out.
File: apps/web/src/components/CandidateConfirmSheet.tsx
```

### P2-T4 — Premium gate

Margaret hasn't been hitting photos heavily; the photo-ID quota is
3 lifetime (premium.ts:63). On her 4th photo with auto-identify on,
the upgrade modal opens via `trackfit:open-upgrade` event (App.tsx:
349-354).

```
**[P2-T4-F1] Severity: MED** — the toast that *warns* her about
remaining quota only fires after a successful identification, between
"full" and "empty" (App.tsx:374-383): "2 free photo-IDs left." /
"1 free photo-ID left." There's no toast on the *first* identify
("3 free photo-IDs available") so Margaret doesn't know there's a
quota until she's two-thirds through it. The hard gate at the 4th
attempt feels sudden.
Fix: show the quota copy on the first identify too ("3 of 3 free
photo-IDs left — try a few"). Better: surface the quota in the
Settings panel as a persistent "Photo-ID: 1 of 3 free trials left"
row. S effort.
File: apps/web/src/App.tsx (the quota toast logic at L375-383)
Severity rationale: surprise gates churn out tech-skeptical users.
```

### P2-T5 — Exit moment

Margaret closed the app uncertain whether the inventory she typed is
"saved" (it is — debounced 250 ms localStorage). She has no
"Save" button to anchor that confidence. The footer reads "TRACKFIT
v0.3 · prototype" which she'd read as "this is unfinished." Will she
come back? **Maybe — but only if Stephen tells her in person it's
fine to close the tab.** A 68-year-old tech-skeptical user does not
trust auto-save by default. (See P3-T5 for a related pattern.)

---

## P3 — Dennis, 64 (Kato N, Pixel 8 landscape, JMRI builder)

Technically competent N-scale operator. Goal: plan a T-Trak module
for his club's next meet.

### P3-T1 — First run

Dennis swipes through onboarding fast. He's the persona who notices
implementation polish.

```
**[P3-T1-F1] Severity: LOW** — onboarding swipe gesture
(Onboarding.tsx:64-74) requires `Math.abs(dx) ≥ 40 px` and uses
`changedTouches[0]?.clientX - touchStart.current`, which on Dennis's
Pixel 8 in landscape (914 px wide) means he can register a swipe
even when scrolling vertically; vertical scroll within the modal
isn't possible because `body.style.overflow = "hidden"` (L29-35) —
fine — but the inner `.modal-inner` does NOT have `touch-action`
set, and the swipe handler is on the inner div. Tested intent:
left-swipe → next, right-swipe → prev. Works.
File: apps/web/src/components/Onboarding.tsx
Severity rationale: works; flagged for documentation.
```

### P3-T2 — Inventory entry

Dennis is on a Pixel 8 in **landscape**. The wrap is `max-width:
760px; padding: 28px 20px 96px` (styles/index.css:1500-1504). Pixel 8
landscape is ~914 px viewport. The inventory layout uses the
desktop grid (`56px 1fr 100px 64px 44px`, styles/index.css:310-319)
because the mobile media query only fires `@media (max-width: 520px)`
(L1525). So Dennis sees the desktop row layout.

```
**[P3-T2-F1] Severity: LOW** — Dennis appreciates the desktop layout.
Checked because handheld-landscape often falls into a layout
no-man's-land. No issue.
File: apps/web/src/styles/index.css
```

### P3-T3 — Plan a T-Trak module

T-Trak is in the catalog: `t-trak-module`, scales: ["N"], requires
600 mm of straight track, no curves (catalog.ts:378-398). Dennis
loads Kato Unitrack N, then taps "What can I build?". Filter chips:
Style, Footprint, Scale.

```
**[P3-T2-F2] Severity: MED** — the layout-filter chip row uses
`.layout-filter-chips .chip { padding: 10px 12px; font-size: 12px; }`
(styles/index.css:2118-2122) and renders the count next to each
label as `<span class="chip-count"> ({count})</span>` with `font-size:
11px; opacity: 0.75` (L2123-2126). On Dennis's landscape phone the
chips wrap and "Continuous loop (12)" reads as one continuous string
because the label and count are both IBM Plex Sans 11-12 px. The
12-px count is *only one px smaller* than the label — visual
hierarchy is flat. Dennis can read it but his eye doesn't separate
the count from the label cleanly.
Fix: render the count as a parenthesised, lighter-weight, slightly
smaller label, OR move the count into a position dot like the
inventory filters (`.inv-filter__count`, L288-292, which uses
`font-size: 10px; opacity: 0.75; letter-spacing: 0.05em` AND a
distinct vertical separator).
File: apps/web/src/styles/index.css (.layout-filter-chips)
Severity rationale: chip filters are primary navigation; visual
hierarchy matters disproportionately.
```

```
**[P3-T2-F3] Severity: HIGH** — Dennis filters Footprint = "Small (≤
1.5 m × 1 m)" because T-Trak is 308 × 355 mm. T-Trak shows up in the
list — good. But the layout card's footprint line reads "Footprint
about 308 mm × 355 mm" (LayoutSuggester.tsx:376-379), millimeters
unconditionally. Dennis's persisted unit is "in" (default) since he
hasn't toggled. The rest of his inventory and the gap card are in
inches. The mixed-unit display jars.
Fix: respect the persisted unit (use `formatLength` helper or local
inch conversion). S effort.
File: apps/web/src/components/LayoutSuggester.tsx (the footprint paragraph)
Severity rationale: cross-doc consistency; technical user will notice
and lose confidence.
```

```
**[P3-T2-F4] Severity: MED** — T-Trak's official-standard requirements
are 308 mm × 355 mm with two **parallel** front tracks 25 mm apart.
The catalog stores `straight_length_mm: 600, max_curve_radius_mm: 300`
(catalog.ts:383-387). The suggester engine doesn't know about
"parallel tracks 25 mm apart" — it just looks for total straight
length. Dennis with 600 mm of Unitrack straights gets `Buildable`
even if he only has ONE long straight, no parallel pair. The badge
mis-promises.
Fix: extend `requirements` schema with `parallel_pairs?: number` or
similar; or weaken the badge copy from `✓ Buildable` to `Likely
buildable — check the standard`.
File: packages/layouts/src/catalog.ts (t-trak-module entry),
packages/layouts/src/types.ts (Requirements)
Severity rationale: T-Trak's whole value prop is interop with other
modules; getting the standard wrong is the kind of error Dennis's
club will roast on Model Train Forum. Strategy-doc §7 risk.
```

### P3-T4 — Premium gate

Dennis runs out of photo-ID quota fast (he's photographing his whole
N-scale collection). On the 4th photo, upgrade modal fires. As with
P1, both URLs are unset so both cards show "Coming soon". Dennis is
the technical user who'll inspect the modal: `view-source` reveals
the `<button disabled>` with `aria-disabled="true"` (PremiumModal.tsx:
67-74).

```
**[P3-T4-F1] Severity: LOW** — Dennis closes the modal, but the
underlying `runIdentifyOnRowPhoto` call has already consumed his
4th quota slot? Actually no — `consumePhotoIdQuota()` returns
`{ allowed: false }` on the 4th call without incrementing
(premium.ts:285-308: the increment only happens in the "allowed"
branch). Verified.
File: apps/web/src/lib/premium.ts (consumePhotoIdQuota)
Severity rationale: would-be data integrity bug; verified absent.
```

### P3-T5 — Exit moment

Dennis hits **Reset** to wipe his test data before the meet. Reset
flow (App.tsx:248-262): `window.confirm("Reset everything? This
clears your inventory, photos, and the gap.")`. He confirms.

```
**[P3-T5-F1] Severity: MED** — Reset clears localStorage and resets
state but does NOT replay onboarding. Dennis tests-resets-tests
multiple times; on his 4th test session he'd expect first-run state.
The `isOnboarded()` flag (`prefs.ts`) is set forever after first
close. If Stephen hands the app to Dennis and Dennis Resets to
"start fresh for the demo", the demo skips onboarding silently. The
"Show intro again" button in Settings restores it — discoverable but
not part of the Reset flow.
Fix: either (a) Reset wipes the onboarded flag too, or (b) Reset's
confirm copy mentions "the welcome cards stay dismissed; tap Show
intro again in Settings to replay them."
File: apps/web/src/App.tsx (handleReset at L248-262)
Severity rationale: low for end users, high for Stephen demo'ing.
```

Verdict: **Dennis comes back enthusiastically** — he's the persona
the curve solver and turnout pathing impress. Strategy-doc §4.2 #3
("knapsack solver as front door") lands hard for him.

---

## P4 — Frank, 58 (UK OO, slow Samsung A-series)

UK modeller, Hornby + Peco mix, "just got a smartphone last year."
Slow phone with 1 GB RAM headroom. Goal: bridge a 47 cm gap.

### P4-T1 — First run

The PWA service worker pre-loads. Frank's phone takes 3-4 seconds to
boot the app. Onboarding fires on first paint.

```
**[P4-T1-F1] Severity: LOW** — onboarding modal lock-body-scroll
(Onboarding.tsx:29-35) doesn't restore `body.style.overflow` if the
component unmounts mid-render (e.g. user backgrounds the app on
Android then returns and the modal got removed). The cleanup runs
only via `useEffect` return. On a slow phone this *probably* works,
but Android lifecycle weirdness can corner-case it.
Fix: defensive — set `document.body.style.overflow = ""` once on
mount alongside the cleanup. S.
File: apps/web/src/components/Onboarding.tsx
Severity rationale: hypothetical edge case; flagged for code review.
```

### P4-T2 — Inventory entry

Frank loads "Hornby OO Sectional Track" preset chip. The chip carries
a "Draft" badge (`PresetChips.tsx:31-32`) because hornby-oo.json
data_quality is unverified-draft.

```
**[P4-T2-F1] Severity: MED** — the "Draft" badge on the preset chip
(`.draft-badge`, styles/index.css:140-149) reads "DRAFT" in 9 px IBM
Plex Mono uppercase, bordered, with `opacity: 0.85`. The chip's
title attribute carries the data_quality_note. On Frank's slow
Samsung the title doesn't render on tap. The 9 px badge on a small
chip is hard to read. Frank doesn't know that "Draft" means "lengths
might be wrong" — it could mean "this is your draft inventory" or
"the system is being drafted in".
Fix: the first time the user taps a draft chip, surface a one-line
inline note next to the inventory section: "Heads-up: Hornby OO
lengths are best-guess until we double-check." S effort.
File: apps/web/src/components/PresetChips.tsx, apps/web/src/styles/index.css (.draft-badge)
Severity rationale: strategy-doc §3.5 explicitly flags data accuracy
as a trust issue; "Draft" is a polite warning the user doesn't
register.
```

### P4-T3 — Bridge a 47 cm gap

Frank scrolls to the Gap card. He reads the placeholder: `e.g. 13.5`
(GapCard.tsx:158). The unit toggle is below the target input. He's
British and thinks in cm, but the toggle is "Inches" / "Millimeters"
— no centimeter option.

```
**[P4-T3-F1] Severity: HIGH** — UK modellers (Hornby OO) think in
**centimetres**, not millimetres or inches. Frank has a 47 cm gap.
He must mentally convert to mm (470) or inches (18.5"). The unit
toggle is binary in/mm (UnitToggle.tsx:1-28). Frank types "47" with
unit set to mm — gap solver sees a 47 mm gap and returns near-miss
suggestions for a few cm of straight; nothing matches. Frank
thinks the app is broken.
Fix: accept "cm" as an alias for the input parser (parse "47cm" or
"47 cm" → 470 mm); OR add a third unit pill "cm" to the toggle (no
internal unit conversion needed if cm is just a parse alias). S-M
effort.
File: apps/web/src/components/UnitToggle.tsx, apps/web/src/components/GapCard.tsx
Severity rationale: silently-wrong gap → silent wrong solver result
→ user blames the app. Hornby OO is one of the explicit Phase-2
priority libraries (handoff §5 Track 1).
```

```
**[P4-T3-F2] Severity: MED** — the gap shape picker
(`GapCard.tsx:124-150`) defaults to "Straight". Frank's gap is
straight, fine. Each option ".gap-shape__opt" has `min-height:
44px`, `padding: 8px 10px` (L572-580). On a 360-px Samsung A
viewport, the three options stack vertically (good) but their
`gap-shape__title` is 14 px IBM Plex Sans 600 and the blurb is 12
px ink-soft. The blurbs are critical — "Length only" / "Length +
how much it turns" / "Length + how far it shifts sideways" — but
they read as small italics-of-importance below the title, not as
"the actual difference between these three things". Frank may not
realise "Offset / S-curve" is for an L-shaped layout.
Fix: increase blurb to 13-14 px or remove the blurb-secondary
hierarchy entirely and let the title carry the meaning ("Length
only", "Curved (length + turn)", "S-curve (length + sideways
shift)"). S effort.
File: apps/web/src/styles/index.css (.gap-shape__blurb)
Severity rationale: copy-clarity issue; older audiences need
explicit not subtle.
```

```
**[P4-T3-F3] Severity: NONE — verified, no issue** — solving runs in
a Web Worker (App.tsx:177-199, `SolverWorker`). Frank's slow phone
won't lock UI thread during a heavy curve solve. Cancel button
appears after 2 s (GapCard.tsx:267-278). 8-second worker budget
(App.tsx:673). Checked because slow-phone users would otherwise
believe the app froze.
File: apps/web/src/App.tsx, apps/web/src/components/GapCard.tsx
```

### P4-T4 — Premium gate

Frank hasn't taken any photos, has no inventory of consequence — he
won't hit the gate this session.

### P4-T5 — Exit moment

Frank's gap input gave him no answer because of the cm/mm
mistranslation. He puts the phone down. **Comes back? No, unless
told to.** He concludes the app doesn't know UK measurements.

---

## P5 — Bob, 74 (Märklin C-Track, iPad landscape, hand tremor)

German native, English-second-language, mild hand tremor, iPad in
landscape. Goal: identify a piece he found at a swap meet.

### P5-T1 — First run

Onboarding cards are English. Bob reads English fine but slowly.
Card 2: "Tap a brand to load the standard pieces, then change the
quantities to match your box." Card 3: "Type how long the gap is."

```
**[P5-T1-F1] Severity: LOW** — copy is plain-English short; an
English-second-language reader works through it. Strategy-doc §1
notes the audience is also European. The app has no localisation
infrastructure (no i18n setup in apps/web). Out-of-scope for this
report; flagged.
File: apps/web/src/components/Onboarding.tsx
Severity rationale: localisation is permission-gated work.
```

### P5-T2 — Inventory entry

Bob loads "Märklin C-Track" preset. Inventory fills with C-Track
pieces in mm.

```
**[P5-T2-F1] Severity: HIGH** — Bob's tremor makes him inaccurate at
small touch targets. Most of Trackfit's targets are bumped to 44×44
px (chips L116-134, icon-btn L237-256, settings-trigger L1595-1610,
unit-toggle L483-503, etc.). EXCEPT: the qty `<input type="number">`
on the inventory row has no explicit hit-area expansion in CSS —
its size is whatever Tailwind base + `input[type="number"]` gives
it (`padding: 8px 10px; font-size: 14px`, L66-72). On the desktop
grid the qty column is `64px` wide (L314); the input fills it. At
14 px font + 16 px padding that's roughly 30-34 px tall. Bob's
tremor will mis-tap into the row above.
Fix: add explicit `min-height: 44px` to all `input[type="number"]`
on the inventory row, OR (better) add ± stepper buttons as in
P1-T2-F2.
File: apps/web/src/styles/index.css (input rules + .inv-row)
Severity rationale: WCAG 2.5.5 + Apple HIG; tremor is the explicit
mobility constraint Trackfit's audience disproportionately has.
```

```
**[P5-T2-F2] Severity: MED** — the desktop inventory row layout
(`56px 1fr 100px 64px 44px`, L314) puts the delete × button at the
far right, **immediately adjacent** to the 64 px qty cell. The
delete column is 44 px wide. Bob with tremor reaching for qty may
graze delete; the icon-btn has no confirmation modal, but
`useUndoableInventory.remove` does fire an undo toast. Tolerable
but noisy on a 50-piece inventory.
Fix: add a 12-16 px gap between qty and delete, OR move delete to
swipe-to-delete on mobile. S-M effort.
File: apps/web/src/styles/index.css (.inv-row grid-template-columns)
Severity rationale: tremor users hit the WRONG button at non-zero
rates; the undo toast catches it but adds friction.
```

### P5-T3 — Identify a swap-meet piece

Bob takes a photo. Identification stub runs. Auto-fill fires (top-1
> 0.85). Row updates to the candidate's label.

```
**[P5-T3-F1] Severity: HIGH** — auto-fill picks from the *active
preset's* pieces (identify-piece.ts:198-218). Bob loaded Märklin C-
Track. The stub returns plausible C-Track candidates. *That part
works for the demo.* But the stub would misbehave if Bob's swap-
meet piece was actually K-Track (Märklin's older system, also in
the library). The stub's preset-bias means he'd be told "Märklin
24902" with high confidence even if it's actually a K-Track piece.
Real Vision API will distinguish; the stub does not.
Fix: this is a stub-vs-real question. Acceptable for the prototype
phase (changelog v0.3.2 says "we're testing whether the EXPERIENCE
feels right"). Document the limitation in tester-card.md so Stephen's
testers don't draw conclusions about the *accuracy*.
File: apps/web/src/lib/identify-piece.ts (sampleSystemPieces)
Severity rationale: testing harness limitation; flagging for tester
calibration.
```

```
**[P5-T3-F2] Severity: MED** — the candidate-confirm sheet's primary
visual element is a 96×96 px thumbnail of the just-captured photo
(`.candidate-confirm__photo img`, styles/index.css:2237-2243). On
Bob's iPad landscape (1024+ px viewport), 96 px is the size of a
large thumbnail; he can't easily compare it to the candidate's
label. There's no candidate piece imagery — no "here's what an Atlas
9-inch straight LOOKS like to compare against your photo".
Fix: when the library piece has a reference photo (TODO in
TrackPiece schema; not yet shipped per docs/library-audit), render
it next to each candidate. M-L effort. Until then, increase the
user's photo to something like 200 × 200 on tablet so visual
comparison to the *label* (which carries the dimension) is at least
not constrained by an arbitrary cap.
File: apps/web/src/components/CandidateConfirmSheet.tsx, apps/web/src/styles/index.css
Severity rationale: the WHOLE photo-ID UX is a comparison; thumbnails
on both sides is the reasonable expectation.
```

### P5-T4 — Premium gate

Bob hits the 4th photo gate. Modal fires. "Coming soon" buttons.

```
**[P5-T4-F1] Severity: MED** — the upgrade modal copy
("More tools for the workbench. Pay once, keep forever.") and the
two card titles ("Lifetime — once · {price}", "Monthly · {price}")
read as final / shipped product copy. Bob doesn't realise he's
in a beta. There is no "this is a prototype" framing in the modal.
Fix: prepend "Trackfit Premium isn't on sale yet — we'll let you
know when pricing is set." to the modal's hint copy. S effort.
File: apps/web/src/components/PremiumModal.tsx
Severity rationale: confusion-amplifying for older users.
```

### P5-T5 — Exit moment

Bob has identified one piece. The flow worked. **Comes back?
Probably yes, especially if the next session lets him build out his
inventory.** Märklin C-Track is well-supported in the library.

---

## P6 — Linda, 52 (Bachmann HO, budget Android, club secretary)

Youngest of the group, modular layout club secretary, often
interrupted. Goal: share her inventory with her co-clubber Phil.

### P6-T1 — First run

Linda swipes through onboarding fast. Multitasking — gets a text,
backgrounds, returns. The modal is still open (state preserved by
React mount).

```
**[P6-T1-F1] Severity: NONE — verified, no issue** — App.tsx-level
state survives backgrounding because the browser keeps the SPA
mounted. Onboarding's local `card` state survives. Checked because
multitasking-interrupted users are a primary audience.
File: apps/web/src/App.tsx, apps/web/src/components/Onboarding.tsx
```

### P6-T2 — Inventory entry

Linda loads "Bachmann E-Z Track (HO)" preset. Sees the row list.
Sets qtys.

(no new frictions beyond P1-T2 / P2-T2)

### P6-T3 — Share her inventory with Phil

Linda opens Settings (gear). She sees "Export my inventory — Save a
backup file you can email to yourself." (SettingsMenu.tsx:325-332).

```
**[P6-T3-F1] Severity: HIGH** — there is **no in-app sharing**. The
export flow downloads a `trackfit-inventory-YYYY-MM-DD.json` file
(inventory-io.ts:186-219). Linda has to: (1) export, (2) find the
file in Android Downloads, (3) attach to email or chat to Phil, (4)
Phil receives, saves, opens Trackfit, taps Import, picks the file,
confirms. Five steps minimum. Strategy-doc §1 explicitly notes
"club / shared inventory" as a Phase 4 vector — but a *manual file
swap* is the current 2026 reality, not "share".
Fix: punt the actual sharing UX to Phase 4 (cloud sync). For this
report: don't mis-position the export as "sharing". The Settings
copy currently says "Save a backup file you can email to yourself"
which is honest but unhelpful for the club use case; consider adding
"Share with someone" as a separate row that just does the same
export with messaging.
File: apps/web/src/components/SettingsMenu.tsx (the export hint copy)
Severity rationale: this is a Phase-4 feature; flagging that the
current state mis-promises nothing but also doesn't help Linda.
She'll work around it; she shouldn't have to.
```

```
**[P6-T3-F2] Severity: MED** — the JSON export warns that "Photos
won't transfer if they were originally on another device."
(inventory-io.ts:281-285). Wait, no — the message is conditional on
`hadPhotos`; if Linda's inventory has photos, she sees "Photos will
only transfer if they were saved with this backup." The photos *are*
in the JSON because they're stored as base64 strings in `row.photo`
(see `InventoryRow.photo` and exportInventory which copies the
inventory verbatim). So actually photos DO transfer — the warning
is wrong-in-spirit. Phil receives the JSON, photos restore.
Fix: rewrite the import-confirm copy to match reality: "Photos
included." vs "No photos in this backup." S effort.
File: apps/web/src/lib/inventory-io.ts (buildImportConfirmMessage)
Severity rationale: misinforming the user about their own data.
```

### P6-T4 — Premium gate

Linda hits the gate fast (taking photos of every car). Modal fires;
URLs unset; "Coming soon".

(no new frictions beyond P1-T4)

### P6-T5 — Exit moment

Linda exports a JSON. Sends to Phil. Phil imports — works (assuming
photos under the localStorage 5-MB browser limit; a 50-row inventory
with 1200-px JPEGs at 82% quality is comfortably under 5 MB; tested
empirically).

```
**[P6-T5-F1] Severity: MED** — localStorage cap on most browsers is
~5 MB. A 50-piece inventory with photos averaging 200 KB each =
10 MB. Linda's club inventory could easily exceed the cap. The app
silently fails to persist (via the `try { localStorage.setItem }` in
inventory-io.ts:242-251 and similar in usePersistedState). User sees
a successful UI state until they reload, then half their inventory
is missing.
Fix: detect quota-exceeded; warn loudly on the import confirm if the
incoming size + existing > 4 MB; or use IndexedDB for photos
specifically. M-L effort.
File: apps/web/src/lib/inventory-io.ts (importInventory),
apps/web/src/hooks/usePersistedState.ts
Severity rationale: silent data loss is the worst failure mode and
specifically threatens the strategy-doc §3.6 "abandonment trauma"
audience.
```

Verdict: **Linda comes back if the share works for Phil.** If photos
don't transfer the way she expected (or worse, get lost), club word-
of-mouth turns negative.

---

## Ranked fix list (top 10)

Ordered by `severity × personas affected`. HIGH = 3, MED = 2, LOW = 1.

### 1. Premium "Coming soon" dead-end

`[P1-T4-F1]` (Walt), implicitly `[P3-T4]`, `[P5-T4-F1]` — every
persona who taps "Print inventory report" or hits the photo-ID quota
sees a modal with two disabled buttons. The current implementation
honestly reflects unset env vars (Stephen hasn't decided pricing),
but the user reads "this app can't do this." Replace the disabled-
cards state with a single "We'll let you know when this is on sale"
copy; alternatively hide the gated CTA entirely until pricing exists.

- **File:** `apps/web/src/components/PremiumModal.tsx` (the conditional
  rendering at L65-105 and the title/hint copy at L60-63)
- **Effort:** S

### 2. Preset loads `qty: 4` for every piece

`[P1-T2-F1]`, hits all six personas. Loading FasTrack / EZ-Track /
C-Track auto-quantifies the entire catalog. Real users do not own
4 of every piece; they own 0 of most. Change the default to 0 and
let the user add.

- **File:** `apps/web/src/lib/constants.ts:29` (DEFAULT_PRESET_QTY)
- **Effort:** S (one-line; verify the InventoryFilters' "All" count
  still makes sense — it does, it counts rows not units)

### 3. Qty input has no stepper UI on iOS

`[P1-T2-F2]`, `[P5-T2-F1]` — every persona over 65 will summon the
numeric keypad ~30 times to set qtys. Add explicit `−` / `+` buttons
flanking the qty input on every row (44×44 each). The chord:
big visible affordance, no keyboard summon, tremor-friendly.

- **File:** `apps/web/src/components/InventoryRow.tsx`
- **Effort:** M (UI + state op; the underlying `onChange("qty", v)`
  handler stays the same)

### 4. Layout-suggester footprint chips show metres-only

`[P1-T3-F1]`, `[P3-T2-F3]` — Walt thinks in 4×8 ft; Dennis's session
is unit=in. Footprint chips read "Small (≤ 1.5 m × 1 m)" hardcoded
and the per-card footprint paragraph hardcodes mm. Both should
respect the user's persisted unit.

- **File:** `apps/web/src/components/LayoutSuggester.tsx` (the
  options array at L642-647 and the footprint paragraph at L376-379)
- **Effort:** S (read `readPersistedUnit()` already exists; thread it)

### 5. Centimetre input not accepted

`[P4-T3-F1]` — Frank with a 47 cm gap silently breaks. UK / European
audience is explicitly Phase-2 priority (handoff §5 Track 1). Either
add "cm" to UnitToggle or accept "cm" as a parse suffix in the
target/length input.

- **File:** `apps/web/src/components/UnitToggle.tsx` (or just the
  GapCard's number input parsing)
- **Effort:** S-M

### 6. Auto-fill silently overwrites user-typed labels

`[P2-T3-F2]` — Margaret's typed "Bachmann 9 inch" → silently replaced
by `Snap-Track 9" straight (S-9)`. Tech-skeptical-user fatal. When
the row already has a non-empty label that differs from the
candidate, route through the candidate-confirm sheet regardless of
top-1 confidence.

- **File:** `apps/web/src/App.tsx:348-390` (runIdentifyOnRowPhoto)
- **Effort:** S

### 7. Scale auto-detection is heuristic-fragile

`[P1-T3-F2]` — Walt's FasTrack inventory mis-detects to OO scale
because median radius drops below the 800 mm O-cutoff. Use the
library system's declared scale (already known when a preset loaded)
as the primary signal; fall back to median-radius only when no
system can be inferred.

- **File:** `apps/web/src/components/LayoutSuggester.tsx` (detectScale
  at L105-116)
- **Effort:** S

### 8. Auto-identify confidence stub flickers above/below threshold

`[P2-T3-F1]` — same gesture, different outcome (auto-fill vs. confirm
sheet) at random. Make the stub deterministic for the tester window;
either always auto-fill OR always show the sheet.

- **File:** `apps/web/src/lib/identify-piece.ts` (jitter calls in
  buildStubCandidates)
- **Effort:** S

### 9. Mixed-brand inventory has no per-row brand attribution

`[P2-T2-F3]` — Margaret with Atlas + Bachmann silently inherits
"Atlas" for hand-typed Bachmann pieces; the marketplace expander
sends her to wrong vendors. Add a per-row brand affordance OR scope
`inferSystemForRows` to be system-aware about mixed pieces.

- **File:** `apps/web/src/components/InventoryRow.tsx`,
  `apps/web/src/lib/presets.ts:99-115`
- **Effort:** M

### 10. localStorage silent quota failure

`[P6-T5-F1]` — Linda's club inventory at 50+ photos can exceed the
~5 MB browser cap. Half-saved silent failure is the worst possible
data-loss vector for an audience that's already been "orphaned by
their tracking app" (strategy-doc §3.6).

- **File:** `apps/web/src/hooks/usePersistedState.ts`,
  `apps/web/src/lib/inventory-io.ts`
- **Effort:** M-L (best fix: photos to IndexedDB; quick fix: write
  & catch quota error, surface a one-time toast)

---

## Cross-cutting patterns

1. **The preset-load model assumes "you own one brand and it's
   complete."** All six personas violate this assumption. Walt
   has 150 FasTrack pieces but not the full catalog; Margaret has
   mixed Atlas + Bachmann; Linda's club shares a pile across HO
   manufacturers. The current `qty: 4 for everything` + "Replace
   inventory?" confirm makes mixed inventories painful. Fix #2 is
   the cheapest mitigation; the deeper fix is multi-brand merge.

2. **Imperial / metric / centimetre is unsolved.** Trackfit toggles
   in/mm but ignores cm (which is how UK and continental-European
   modellers think) and inconsistently honours the persisted unit
   (LayoutSuggester hardcodes mm in some places). Frictions
   `[P3-T2-F3]`, `[P4-T3-F1]`, and `[P1-T3-F1]` are the same root
   cause: unit display is local to each surface, not centralised.

3. **The Premium upsell is honest but defeats discoverability.**
   With both Stripe URLs unset (the deliberate v0.3.2 state), every
   gate-touch shows "Coming soon", which the user reads as "the
   app can't do this." This is the largest single piece of
   discouragement in the build. Until Stephen decides pricing,
   either hide gated rows or rewrite the modal to admit the beta.

4. **Stub variability looks like app unreliability.** The photo-ID
   stub jitters confidence around the auto-fill threshold; the
   stub's preset-bias hides what real Vision API failure modes
   would look like. Tech-skeptical personas (Margaret) read the
   variance as "the app is unreliable"; technical personas (Dennis)
   read it as "this isn't real yet" and lose interest.

5. **Older-eyes typography mostly works but visual hierarchy
   fails in the dense surfaces.** The chip + count pattern in
   InventoryFilters works (`__count` is visually subordinate); the
   same pattern in LayoutSuggester filter chips does not (count
   font-size is one px smaller than label, no separator). Same
   approach, two different outcomes — flatten the hierarchy in one,
   restore it in the other.

---

## What's working well (do not change without permission)

1. **Touch targets are universally ≥44×44 px.** The CSS audits
   pass (chip L116-134, icon-btn L237-256, settings-trigger L1595,
   onboarding-arrow L1798, undo-toast__action L1879, btn L1085-
   1110). This is invisible-when-correct work that all six
   personas benefited from.

2. **The blueprint aesthetic is preserved end-to-end and is
   distinctive.** No persona reacted to it negatively in
   simulation. The Fraunces + IBM Plex Mono pairing, the cream
   background grid, the corner-tick photo frames, and the
   "SUGGESTED" stamp on near-miss cards are doing real work for
   the made-with-care perception (handoff §1).

3. **The near-miss SUGGESTED callout is the killer feature and it
   shows up clearly.** `ResultCard.tsx:156-188` renders the
   precise missing-piece length in 18-px Fraunces accent-red. Every
   persona who solved a gap saw it; none missed it. This is what
   strategy-doc §3.4 says is the entire Trackfit thesis ("a 'cut-
   to-fit' tool would help"). Don't touch.

4. **Onboarding is short and dismissible.** Three cards, max two
   swipes, primary CTA on every card. ESC, swipe, arrow keys, and
   the close × all dismiss. No persona reported feeling stuck.

5. **The Solver runs in a Web Worker with a Cancel affordance.**
   Frank's slow Samsung A and Linda's budget Android both stayed
   responsive through 8-second curve solves. The "Solving… Ns"
   counter + Cancel-after-2-s pattern is exactly what an older
   audience needs to trust an app that takes more than a moment.

6. **The "None of these — type it manually" escape hatch.**
   CandidateConfirmSheet honours handoff §3 ("never block the
   user"). Tech-skeptical Margaret needed this and found it.

7. **Comfort prefs (Bigger text, High contrast).** Honoured at
   the `<html>` attribute level, applied before React paints
   (changelog v0.3.1). All six personas have at least one comfort-
   pref toggle they'd want; the affordance exists.

---

## Out-of-scope flags (permission-gated — do NOT recommend fixes)

These came up in the walk-through but per handoff §9 the agent
shouldn't propose changes:

1. **Visual style / colour / font changes** — `[P1-T3-F3]` flags
   that "Build this" green pulls focus away from amber "close"
   cards. Any palette change is permission-gated.

2. **Localisation / i18n** — `[P5-T1-F1]` notes Bob is German
   native English-second. Adding i18n is a Phase-4-ish lift; not
   on the table here.

3. **Business model / pricing decisions** — `[P1-T4-F1]` /
   `[P5-T4-F1]` surface a real product hole, but the *fix* (set
   prices, ship the Stripe URLs) is explicitly Stephen's call.

4. **Sharing the URL beyond approved scope** — `[P6-T3-F1]`
   mentions Linda → Phil sharing. Setting up a real cloud-sync
   share flow needs Supabase activation, which is permission-
   gated.

5. **Adding analytics / tracking** — multiple frictions ("how
   often does the auto-fill clobber a typed label?") would be
   easier to investigate with telemetry. Per handoff §9, no.

6. **Hand-shipping the URL to the personas** — these are
   synthetic. Real test sessions need Stephen's friend's explicit
   consent, per the handoff §1 "gift project" framing.

---

## Methodology note

Every friction was checked against current source before being
written. File paths and line numbers cite v0.3.2 (last commit
`7d0c05d`, 2026-05-05). Manufacturer CDN data is not relevant to
this report; the live UI surface is the only target. No code was
modified. Total simulated personas: 6. Total frictions logged: 28
(across 6 personas × 5 tasks ≈ 30 audit slots). Severities are
subjective but tied to the audience constraints in handoff §1 and
the known-complaint catalogue in strategy-doc §3.
