# Trackfit changelog

Per handoff §11. This is not marketing copy — it's a forensic record of
what shipped, what didn't, and what tradeoffs were made, so future-us
can answer "did we end up using clothoid spirals or simple arcs?"
without re-reading the entire git history.

Newest entries on top.

---

## v0.3.5 — 2026-05-18 (launch-prep pass)

First version cut for a public, paid launch. Engine hardening + the
monetization decision, no speculative features.

### Engine

#### O-gauge layout templates (`packages/layouts/src/catalog.ts`)

Added three `scales: ["O"]` templates — `o-starter-oval`,
`o-loop-with-siding`, `christmas-tree-loop-o` — with O-honest
footprints (1500–2100 mm wide). The v1 catalog was 20 universal /
HO-N-pinned templates; an O-gauge (Lionel-world) user — the original
v1 persona — saw HO-sized footprints quietly under-reading their
space. Universal templates still surface for O; these add scale-true
sketches. Numbers are plausible-not-precise per the catalog's own
contract; no library-accuracy claim is implied.

`MAX_SUGGESTIONS` in `suggest.ts` changed from a hardcoded `20` to
`LAYOUT_TEMPLATES.length` so scale-pinned templates can never be
sliced off the end as the catalog grows.

#### Buildable vs. near-miss grouping (`LayoutSuggester.tsx`)

The suggester rendered a flat list (engine-sorted buildable-first,
but no visual break). Focus-group personas stop reading after the
first few cards. Now partitions the already-sorted list into a
"✓ You can build these now (N)" group and a "You're close to these
(N)" group with plain-English headers. Presentational only — the
deterministic ranking is untouched, no re-sort.

#### Gap-solver timeout empty-state (`ResultsList.tsx`)

If the solver hit its wall-clock budget *before any* near-miss
surfaced, the user fell through to "Nothing in your inventory comes
close to this gap" — false; it just ran out of clock on a large
inventory. Added a `timed_out && !bestNearMiss` guard with an honest
"ran out of time, not 'nothing fits'" message. (The `timed_out` +
*has* near-miss case was already handled; this was the missing edge.)

### Monetization

Launch model decided: a single **one-time Founder license** (no
subscription — this demographic resents recurring billing; the hobby
buys software once). `env.ts` `lifetimePrice` default `$29` → `$19`.
`PremiumModal` copy reworked to (a) be Founder-framed and (b) stop
overselling: it no longer claims cloud sync (not deployed) or paid
cut-templates (cut templates are free); it now states the inventory
binder + full vendor list are live and photo-ID auto-fill "rolls out
to Founders". Photo-ID stays on the stub — no paid Vision spend until
there is a Founder-revenue signal. Payment link still env-gated:
unset → honest fake-door; set → real buy link. No Stripe SDK, no
analytics added.

### Packaging

Version off the perpetual `0.3.0-dev` → `0.3.5`. README rewritten
from a one-line stub to an accurate, claim-safe project README.

---

## v0.3.4 — 2026-05-05 (fourth pass, same day)

### Round-2 focus-group fixes (M-effort)

#### Qty stepper buttons (focus-group P1-T2-F2 + P5-T2-F1)

Every inventory row now renders `[−][input][+]` with 44 × 44 px
buttons (WCAG 2.5.5 / Apple HIG). The input itself stays editable
for users who want to type a specific number. `−` clamps at 0 and
shows a disabled state; `+` has no upper bound (some O-scale
collectors own 200 of one piece). Desktop grid widened 64 → 140 px;
mobile stack gives the qty row its own line.

#### Per-row brand attribution (focus-group P2-T2-F3)

Optional `system_id?: string` field on `InventoryRow`. Set by preset
loads (`presetToInventory`) and picker adds (`pieceToInventoryRow`);
omitted on hand-typed rows. A small brand chip renders beside the
label when `system_id` is set; hand-typed rows show no chip and
have no brand picker (we don't add a 5th decision).

`inferSystemForRows` now prefers explicit `system_id` over label-
match counting. The original heuristic stays as the fallback.
ResultCard's marketplace expander picks per-piece brand, with a small
"(N other brand pieces in this combo)" note when a solution mixes
brands.

#### localStorage quota safety net (focus-group P6-T5-F1)

Detect-and-warn only this round (IndexedDB photo migration is
round 3). New `lib/storage.ts`: `safeSetItem` wraps
`localStorage.setItem` in a typed try-catch that classifies errors as
`quota` / `blocked` / `unknown`. Three call sites updated:
`usePersistedState` autosave, `prefs.savePrefs`, and
`inventory-io.importInventory` (plus a pre-flight size warning on
the import-confirm dialog).

UI: `<StorageWarningToast>` subscribes to a window event. Plain-
English copy: "Your phone is out of space for Trackfit. Try deleting
some photos from your inventory, or export your inventory to back it
up first." Per handoff §3, the warning is a safety net, not a stop
sign.

### `@trackfit/plan-import` package

Foundation for strategy-doc §5 Phase 2 "Plan import" feature. New
package parses AnyRail XML plan files into a typed
`PlanRequirement[]`, then diffs against inventory to produce a
`BuyListEntry[]`. 18 tests across 3 fixtures. Defensive parser per
handoff §3 and strategy §3.5: malformed XML returns empty + warning
(never throws), unknown library ids stamp `system_id: "unknown"` and
warn rather than guessing.

Hand-rolled regex parser (no XML dep) — the AnyRail shape is
shallow enough that adding `@xmldom/xmldom` would be wire weight.
Public surface stays stable if we swap to a real DOM parser later.

Not yet wired into `apps/web` — UI integration is round 3.

### Empty-state, tooltip, and what's-new polish

- New true-empty inventory state ("Your box is empty. Two ways to
  start: …") with explicit numbered guidance — the previous state
  silently showed an empty list.
- `<ScoreBar>` in the layout suggester gets a `title` tooltip
  explaining what 5-of-5 vs fewer blocks means (focus-group Walt
  + Bob).
- `docs/whats-new-v0.3.4.md` — a calibrated-for-tester summary of
  what's shipped this build, plus a pre-share checklist Stephen can
  run before each tester session.

### Solver test margin bumped

The "wall-clock timeout default returns within N seconds" test was
flaky under `pnpm -r test` parallel CPU contention on Codespaces.
Bumped from 7 s → 10 s; still catches a real regression but absorbs
shared-infra slack.

### What didn't ship this milestone

- **Photos to IndexedDB** — localStorage cap hits club-sized
  inventories. Round 3 work; this build only detects + warns.
- **JMRI export** — generate PanelPro-compatible XML from a solved
  chain. Round 3.
- **Voice input** — Web Speech API; older users would appreciate it.
  Round 3.
- **Plan-import UI** — package is ready; the "Drop a plan" surface
  isn't. Round 3.
- **Real Anthropic Vision API call** — still gated on Stephen's
  $5 budget signoff and a deployed Supabase edge function.

---

## v0.3.3 — 2026-05-05 (third pass, same day)

### Inventory comfort: piece-picker + accordion grouping

Stephen's call after using the app himself: "drop down pickers for
pieces would probably make it so much more comfortable." Two
coordinated changes that make the inventory list less overwhelming
without removing any expressive power:

- **Piece picker** — "+ Add piece" now opens a `<PiecePicker>` modal
  with a searchable, kind-grouped catalog of every piece in the
  active preset (or every system when none is loaded). Each entry
  shows label, plain-English dimension ("9 in" / "22 in radius · 30°"
  / "#4 turnout"), product code, and an "in inventory: N" chip when
  already owned. Tapping adds (or bumps qty by 1 on a geometric-
  identity dedupe — kind + length + radius + arc + frog), no typing
  required. A "Type a custom piece →" footer preserves the legacy
  empty-row escape per handoff §3.
- **Accordion grouping** — inventory rows group by kind (Straights /
  Curves / Turnouts / Crossings / Other) in `<details>`/`<summary>`
  sections. Each header shows count + summary. Default expansion:
  every group open when ≤ 8 rows; otherwise only the most-recently-
  edited group stays open. User toggles are session-sticky.

### Synthetic focus-group stress test

A red-team review at `docs/focus-group-stress-test-2026-05.md`. Six
older-hobbyist personas (Walt 71 / Margaret 68 / Dennis 64 / Frank
58 / Bob 74 / Linda 52) walked through five tasks each (first-run,
inventory entry, core task, Premium gate, exit moment) against the
live source. 28 frictions logged, every one verified against actual
code paths with file:line citations.

Top finding: with both Stripe URLs intentionally unset, every
persona who taps "Print inventory report" or hits the 4th-photo
quota sees an upgrade modal with two disabled "Coming soon"
buttons — reads as "the app can't do this." Largest single
dampener in the build. Other top frictions ranked, with concrete
diff suggestions.

### Round-1 focus-group fixes (S-effort top 7)

- **Premium "Coming soon" rewrite.** When no payment URLs are set,
  the modal shows a calm "we're still figuring out a fair price"
  body and a single "Got it" button instead of two disabled cards.
- **DEFAULT_PRESET_QTY 4 → 0.** Real users own 0 of most catalog
  SKUs; the old default forced ~30 rows of qty edits on every preset
  load. Picker-added pieces still default to qty 1 via the picker's
  own defensive fallback.
- **Footprint chips and per-card footprint respect persisted unit.**
  Imperial users see "Small (≤ 5 ft × 3 ft)" and "Footprint about
  4 ft × 8 ft"; metric users still get mm. (Walt's 4×8 ft mental
  math is gone.)
- **Centimetre input.** Target / tolerance fields accept "47cm",
  "47 cm", "470mm", "18in", or `18"` suffixes. Suffix overrides
  the unit toggle for that field. New `parseLengthExpression`
  centralises the parse. Inputs are now `type="text"
  inputMode="decimal"` so the suffix isn't stripped before parse.
- **Auto-fill won't silently clobber typed labels.** When the row
  has a non-empty label that differs from the top candidate's,
  route through the candidate-confirm sheet regardless of confidence.
- **Scale auto-detect uses library system first.** The
  `TrackSystem.scale` is authoritative when a preset is identifiable
  from labels; median-radius heuristic is the fallback only.
- **Stub confidences are FIXED.** No more 17% chance of "same
  gesture, different outcome" because of jittered top-1 around the
  0.85 auto-fill threshold. Real Vision API will have content-
  driven variance; the stub shouldn't fake it.

Plus: first-photo quota toast ("3 of 3 free photo-IDs left") so the
quota gate at attempt 4 doesn't surprise.

### Discord feedback button

New "Give feedback on Discord" row in Settings, gated on
`VITE_DISCORD_FEEDBACK_URL`. Empty value → row doesn't render.
Stephen fills in the invite URL when his server is ready. Plus
`.env.example` expanded to document Discord, Tally (deprecated
pricing survey), and real-photo-ID env vars alongside the existing
Premium ones.

### Solver guardrails

Reported by Stephen during dev: a 127-inch curved gap solve hung
for "a few minutes with no result." Two complementary defences in
`packages/solver/src/curve.ts`:

- **Feasibility pre-check** — sum the maxPieceCount longest pieces
  vs. target length. Microsecond-fast bail-out with a typed "your
  inventory can't span this gap (X in vs Y in reachable)"
  suggestion when fundamentally unreachable.
- **Wall-clock timeout** — `maxElapsedMs` option (default 6000;
  the UI passes 8000). Each `recurse()` entry checks elapsed time
  and unwinds when the budget is hit. Returns whatever bestNearMiss
  was found with a new `timed_out: true` flag.

UI side: elapsed-time counter ("Solving… 3s") under the Solve
button while a search is running, **Cancel button** that surfaces
after 2 s and terminates+respawns the worker, "Search ran out of
time · best guess so far" banner when timed_out fires, and a
direct rendering of the feasibility-pre-check message ("This gap
is longer than your inventory can span") instead of the generic
empty state.

### What didn't ship this milestone

- **#3 Qty stepper buttons** (M effort, focus-group P1-T2-F2,
  P5-T2-F1). Every persona over 65 will appreciate explicit `−` /
  `+` buttons next to the qty input. Deferred to round 2.
- **#9 Mixed-brand attribution** (M effort, focus-group P2-T2-F3).
  Margaret's hand-typed Bachmann pieces silently inherit Atlas
  vendor links. Deferred to round 2.
- **#10 localStorage quota silent failure** (M-L, focus-group
  P6-T5-F1). Linda's club-sized inventory at 50+ photos can exceed
  the 5 MB cap. Needs IndexedDB migration for photos. Deferred.
- **i18n / localisation** — flagged as permission-gated (handoff §9).
- **Visual palette / pricing decisions** — permission-gated, no fix
  proposed.

---

## v0.3.2 — 2026-05-05 (later same day)

### Pre-launch validation stack

Three coordinated scaffolds that let us learn whether photo-ID and
other paid features will sell — without spending real Claude vision
API money yet. Stephen has a hard rule: no more than $5 spent on
paid-API features until validated as sellable.

**Layer 1 — photo-ID UX scaffold (zero spend).** Every photo capture
runs through `lib/identify-piece.ts`, a typed `identifyPiece(base64)`
that returns three plausible candidates after a 600ms fake delay.
Pulls real pieces from the active preset when one's loaded; HO Atlas
Code 83 defaults otherwise. Top-1 confidence ≥ 0.85 auto-fills the
row; below that, a `<CandidateConfirmSheet>` opens with the three
candidates and a "None of these — type it manually" escape hatch
(per handoff §3, the manual-entry path is never blocked). Real-fetch
path is gated behind `VITE_USE_REAL_PHOTO_ID` and falls back to the
stub on any error.

**Layer 4 — Premium CTA stub.** A "Trackfit Premium" row in Settings
opens a modal with Lifetime / Monthly / "No thanks" cards. Outbound
links read from `VITE_PREMIUM_LIFETIME_URL` / `VITE_PREMIUM_MONTHLY_URL`
env vars. When unset, the cards render disabled with "Coming soon" —
that's the deliberate state today (Stephen hasn't decided pricing).
Whole feature is gated by `VITE_PREMIUM_ENABLED` so the row doesn't
even render if we're not actively testing it.

### Freemium gate system

Stephen's call: rather than a survey-style pricing test, ship as a
real freemium product. The upgrade click on a Stripe link becomes the
validation signal. All gates are wired today; Stripe URLs stay empty
until pricing is decided.

**Free forever, must stay legitimately useful** (Stephen's explicit
constraint): the gap solver and its near-miss SUGGESTED callout
(unlimited), all 16 verified track libraries, manual inventory with
no piece cap, the layout suggester, reference-object gap measurement,
manual photo capture as visual mnemonic, the 1:1 cut-template PDFs
for flex track, JSON export/import, comfort prefs (bigger text, high
contrast), and the top-2 vendors in marketplace expanders. **The
killer feature is free.** Locking the gap solver would kill the
strategy doc's "Shazam of model railroad track" thesis — it's the
hook that brings people in.

**Premium:** photo-ID auto-fill (with **3 free lifetime trials** so
the user tastes the magic before the gate), the insurance-grade
inventory PDF report, and the full 8-vendor marketplace list. Cloud
sync, plan import, and the LLM design assistant are roadmap items —
not in this milestone.

**License model:** `TFP-XXXX-XXXX-XXXX` codes (4+4+4 uppercase
alphanumeric, no confusing 0/O/1/I/L). Stephen issues codes manually
after Stripe Checkout completes — at <50 customers, manual is the
right call. He runs `node scripts/gen-license-code.mjs` to generate
`(code, hash)` pairs, emails the code to the buyer, pastes the hash
into the embedded `VALID_LICENSE_HASHES` allowlist in
`apps/web/src/lib/premium.ts`, and redeploys. Hash-only protection
means inspecting the bundled JS reveals only hashes, not codes; a
casual reader can't generate codes for free.

Persisted in localStorage (`trackfit.premium.v1`). v1 is reusable
across devices on purpose — honest users own multiple devices, and
dishonest users will share regardless. We're not in the DRM business.

**Gate behaviour for non-premium users:**
- 4th photo with auto-identify on → upgrade modal opens via the
  `trackfit:open-upgrade` window event. The photo still attaches to
  the row; only the auto-fill is blocked.
- "Print inventory report" → upgrade modal (the row stays visible
  for discoverability).
- Marketplace expander → top 2 vendors visible, then a `<PremiumGate>`
  strip with "Premium unlocks N more vendors → Upgrade".

**Removed in this milestone:** the auto-firing `<PremiumPricingTest>`
modal (Layer 2 of the original four-layer plan). The upgrade click is
a stronger signal than survey-style "would you pay $X?" answers, and
showing two prompts in a row felt cluttered. The component file stays
on disk for possible re-use; just nothing renders or triggers it.

### Tester card refresh

`docs/tester-card.md` updated to reflect the freemium reality.
Includes a tester-friendly explanation that hitting the upgrade
screen during the test is **expected and fine** — no charges happen,
we're testing whether the flow makes sense. Question 5 explicitly
asks for fair-price intuition (once-only / yearly / monthly / never).
Stephen fills in the contact line and removes the placeholder before
printing.

### What didn't ship this milestone

- **Real Claude vision API call.** Photo-ID is still stubbed.
  `VITE_USE_REAL_PHOTO_ID=true` flips the stub for a real fetch to
  `/api/identify-piece` (the existing `supabase/functions/identify-
  piece/index.ts` edge function), but the function isn't deployed
  and shouldn't be until a paying customer or a clear validation
  signal lands.
- **Stripe checkout / webhook integration.** Manual code issuance
  is correct at <50 customers. Auto-issuance is a Phase 4 problem.
- **Cloud sync.** Schema migrations exist; client wiring doesn't.

---

## v0.3.1 — 2026-05-05

### Layout suggester: chips, plain English, marketplace

- The "What can I build?" modal grew filter chips for **style**
  (continuous-loop / switching / showcase / starter), **footprint**
  (small / medium / large), and **scale** (Z..G). Counts per chip live-
  update as the user filters. Scale auto-detects from the median radius
  of the user's inventory curves on first open; user can override.
- Near-miss cards now render plain-English shortfall sentences:
  *"You'd need about 4 more curve sections (~22.5°) and a 10-inch
  straight"*. Older audiences read sentences faster than per-axis tables
  of `+90° / +250 mm`.
- Inline marketplace expander on near-miss cards. Tapping "Where to buy
  missing pieces" surfaces the top 4 vendors via `@trackfit/marketplace`,
  biased by the inferred system (Märklin pieces unlock Reynaulds, etc.).

### Layout catalog: 11 → 20 templates

Added: around-the-walls shelf, branching dogbone, helix-staging (HO/N
only), mountain switchback, T-Trak module (N), Inglenook 5-3-3,
Timesaver, mining branchline, double-tracked oval. Voice and ASCII
sketch style match the original 11.

Side-effect: yard-ladder turnout requirement bumped 4 → 6. Timesaver
(5 turnouts, switching, no curves) was tying yard-ladder in dense yard
inventories and winning the ambition tiebreaker. 6 leads is genre-
accurate for real yards and restores yard-ladder's intended top rank.

### Suggester ranking tiebreaker

Within a 0.05 score window, suggestions short on **fewer axes** rank
above suggestions short across **more axes**. A layout missing one
piece type is qualitatively closer to buildable than a layout missing
across the board. Buildable layouts still rank first; large score gaps
still dominate.

### Curve solver: turnout v1 pathing

Turnouts are now first-class inventory — they participate in the curve
solver as straight equivalents of length `overall_length_mm` along the
main route. The diverging branch is **deferred** to v2 (see
`TODO(v2 turnout pathing)` in `packages/solver/src/curve.ts`); the
through-route is geometrically a straight, so the search space cost of
the divergent branch is the only honest reason to delay.

NMRA RP-11 conventional minimum radii are now baked into the suggestion
synthesis. When the solver derives a "you'd need a curve of N mm radius"
suggestion that falls below the NMRA recommendation for the user's
scale, the card adds a warning sentence about long-loco reliability.

Default `maxPieceCount` lowered 20 → 12 per design §4.1 ("most fills ≤
8"). Dense inventories (20 types × 30 qty) no longer spend cycles on
chains the user wouldn't actually build.

### Cut-templates: insurance-grade inventory PDF

`renderInventoryReport()` produces a cover + grouped detail pages +
notes-page PDF documenting a user's full inventory. Strategy-doc §4.2
flagged this as a real B2B revenue stream; collectors with five-figure
collections want a paper record for insurance / estate planning.

Photos embed via `embedJpg` only — non-JPEG and malformed JPEGs skip
silently rather than crashing a 50-row report. Landscape by default,
15 mm margins. Tested with Letter, A4, 50-row pagination, and rough-
data resilience (null photos, broken JPEG data URLs, PNG data URLs).

### Settings menu + inventory I/O

Header gear button opens a popover with comfort prefs (bigger text,
high contrast — both reflect via `data-large-text` / `data-high-
contrast` on `<html>`), JSON inventory export/import, the new PDF
report action, and "Show intro again" to replay onboarding cards.

`apps/web/src/lib/inventory-io.ts` defines a versioned wire format
(`schema: "trackfit.inventory"`, `schema_version: 1`). Older backups
stay importable until we explicitly drop them. Photos do **not**
transfer through JSON — the user is warned in the import-confirm
dialog. Cloud sync (Track 5) will replace this for users who sign in.

### Modal accessibility

Shared `useFocusTrap` hook at `apps/web/src/hooks/useFocusTrap.ts`:
~30 lines, no library dep. Tab/Shift-Tab cycle within the modal, ESC
fires the supplied handler, focus restores to the trigger element on
close. Wired into LayoutSuggester, Onboarding, SettingsMenu,
GapMeasureOverlay, and PhotoModal.

Touch targets bumped to ≥ 44 × 44 px in three spots that were below the
WCAG 2.5.5 / Apple-HIG threshold (chips, filter-row chips, "Where to
buy" toggle). Logic + hit-area only; visual style unchanged.

### Library data

Internal-consistency audit at `docs/library-audit-2026-05.md`. 16 files,
405 pieces, 111 curves checked. Zero geometry inconsistencies (every
curve length matches `radius × arc × π/180` within catalog-rounding
tolerance). Zero duplicate IDs, zero missing required fields.

Real findings are documentation-grade: Bachmann turnout SKUs are missing
across N and HO (no datasheet pass yet), Peco turnout overall-lengths
are TODO-flagged pending a datasheet pass, three intentional Märklin /
Kato product_code reuses already noted in author files. Per handoff §3,
"wrong is fatal, empty is honest" — no dimensions were invented to
clean up the audit.

### What didn't ship this milestone

- **Photo-ID via Claude Vision.** Server-side `identify-piece` edge
  function exists at `supabase/functions/identify-piece/index.ts` (227
  lines) but isn't wired into the front-end yet. Permission-gated:
  needs API key budget + Supabase deploy.
- **Cloud sync.** Schema migrations and RLS land in
  `supabase/migrations/`, but client code still hits localStorage only.
  Same permission gate.
- **v2 turnout pathing.** Diverging branch search through turnouts.
  `TODO(v2 turnout pathing)` markers in `packages/solver/src/curve.ts`,
  `apps/web/src/App.tsx`, `apps/web/src/lib/presets.ts` show every
  data-plumbing site that's already ready for the upgrade.
- **Browser print stylesheet.** Originally on the punch-list as Track
  C2; dropped on inspection because the cut templates and inventory
  report are pdf-lib generated, not browser-printed. The web app has
  no surface that would benefit from `@media print`.

---

## v0.3.0 — 2026-05-05 (earlier same day)

Foundation port from v0.2 single-file HTML to monorepo + React PWA.

- Vite + React + TS + Tailwind + Vitest. PWA manifest + service
  worker. Lighthouse PWA score ≥ 90.
- Custom domain wired at trackfit.stevieweedseed.com.
- `packages/solver` — pure TS, v0.2 subset-sum bit-for-bit identical
  on the straight path. New 2D curve solver (see
  `docs/curve-solver-design.md`).
- `packages/library` — 16 verified track systems documented in
  `docs/library-notes/{system}.md`. Schema in
  `packages/library/SCHEMA.md`.
- `packages/layouts` — rule-based layout suggester (no LLM).
- `packages/cut-templates` — pdf-lib renderer for 1:1 cut guides.
- `packages/measure` — reference-object gap measurement (US bill,
  US quarter, EU 1€, UK £1, "use a piece I own"). Browser-only; no
  ARKit/ARCore yet.
- `packages/marketplace` — vendor link generator with locale and
  scale-aware ranking. eBay, Trainz, Walthers, Hattons, Reynaulds,
  Tower Hobbies, ModelTrainStuff, Amazon.
- Onboarding cards, undo toast, photo capture pipeline, persisted
  state.
- Supabase scaffolding (schema + RLS + storage + identify-piece edge
  function) — not yet wired to the client.

### Tradeoffs / decisions

- **No clothoid easements in the curve solver**, just simple circular
  arcs. Handoff §5 "Track 2" explicitly punted easements to a Phase 3
  module. Re-examine when prototype trains start binding on tight
  reverse loops in user testing.
- **localStorage as the v0.3 store**, not Supabase. Sync is
  permission-gated and the friend can use the app immediately on a
  single device without an account. Inventory I/O JSON export bridges
  device swaps until cloud sync lands.
- **No analytics, no third-party scripts.** Permission-gated per
  handoff §9. Stays that way until explicit ask.
- **Manufacturer CDNs are bot-blocked from this Codespace IP**
  (lionel.com / katousa.com / atlasrr.com all 403). Library
  verification work is currently catalog-PDF + dealer-reference based
  rather than live-fetched. See per-system notes in
  `docs/library-notes/`.

---
