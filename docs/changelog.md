# Trackfit changelog

Per handoff §11. This is not marketing copy — it's a forensic record of
what shipped, what didn't, and what tradeoffs were made, so future-us
can answer "did we end up using clothoid spirals or simple arcs?"
without re-reading the entire git history.

Newest entries on top.

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
