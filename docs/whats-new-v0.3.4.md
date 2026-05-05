# What's new — v0.3.4 (2026-05-05)

A short summary of what's shipped in this build, calibrated for
"hand the URL to a tester this afternoon" and "skim before you do".
Full forensic detail lives in `docs/changelog.md`.

---

## You will see this if you open the app

### A friendlier empty inventory
First-run users now see a labeled "Your box is empty" card with two
explicit paths: pick a brand chip, or tap "Add piece". The previous
state was an empty list with no guidance.

### Qty stepper buttons
Every inventory row now has visible **−** and **+** buttons flanking
the qty input. Tap to bump quantity by 1 — no more summoning the
numeric keypad to set qtys on 30 rows. Manual typing still works for
specific numbers. Disabled at 0; no upper bound (collectors with
200 of one piece type are fine).

### Brand chip beside each row's label
Pieces that came from a preset (or the picker) carry a small
"Atlas" / "Bachmann" / "Märklin" chip beside the label. Hand-typed
rows show no chip — and don't pester the user to pick a brand.

### "Where to buy" gets the right brand
The marketplace expander on near-miss results now picks vendors
per-piece-brand instead of guessing from the most-common label. A
mixed-brand combo gets a quiet "(2 other brand pieces in this combo)"
note under the vendor list.

### Plain-English centimetre input
Type "47cm" or "47 cm" in the gap target field — works regardless of
the unit toggle. Also accepts "470mm", "18in", or `18"`. UK and
European modellers can stop mental-math'ing.

### Footprint chips speak your unit
"Small (≤ 5 ft × 3 ft)" when your unit is inches; "Small (≤ 1.5 m ×
1 m)" when it's mm. Per-card footprint readings respect the unit too.

### Solver Cancel button + clearer messages
When a gap solve is taking a while, you see a "Solving… 3s" counter
and after 2 seconds a "Cancel solve" button appears. Solver gives up
gracefully at 8 seconds with "Search ran out of time, here's our
best guess." When your inventory genuinely can't span the gap, the
app says so directly instead of grinding.

### Storage warning
If your phone runs out of room for Trackfit's data, you'll see a
toast: "Your phone is out of space for Trackfit. Try deleting some
photos from your inventory, or export your inventory to back it up
first." Old behaviour was silent data loss on the next reload —
strategy doc §3.6's worst failure mode.

### Score bar tooltip
Hover (or long-press) the 5-block match bar in the layout suggester
to see what it means.

---

## You will see this if you take a photo

Photo-ID is still **stubbed** — we're testing whether the experience
feels right before turning on the real Anthropic Vision API
(per-photo cost ~$0.02–0.05). A few sharper edges:

- The stub now always returns the same plausible top candidate for
  the same active preset — no more "auto-fill sometimes, ask me
  other times" flicker.
- Auto-fill won't silently overwrite a label you already typed —
  if your row says "Bachmann 9 inch" and the candidate is "Atlas
  Snap-Track 9-inch straight", you'll see the candidate-confirm
  sheet instead of a silent swap.
- The first photo identification shows "3 of 3 free photo-IDs left"
  so the gate at the 4th attempt isn't a surprise.

---

## You will see this if you tap "Trackfit Premium"

Until pricing is decided, the Premium modal shows a calm "Photo-ID,
the binder, and the full vendor list will be a paid upgrade. We're
still figuring out a fair price." instead of two disabled "Coming
soon" buttons. Single "Got it" dismiss.

When pricing IS decided, set `VITE_PREMIUM_LIFETIME_URL` /
`VITE_PREMIUM_MONTHLY_URL` env vars and the modal flips to its real
shape with outbound links to Stripe Checkout (or Lemon Squeezy /
whatever the current payment URL is).

---

## What's under the hood (not user-visible but new)

### `@trackfit/plan-import` package
Parses AnyRail XML plan files into a typed `PlanRequirement[]`, then
diffs against the user's inventory to produce a `BuyListEntry[]`
showing what they need to buy. Foundation for the strategy-doc §5
Phase 2 "drop in a plan, get a buy list" feature. UI integration
isn't wired yet — that's the next round.

### Discord feedback button
Set `VITE_DISCORD_FEEDBACK_URL` to your invite URL and a "Give
feedback on Discord" row appears in Settings. Empty value = row
doesn't render.

### License-code generator CLI
`node scripts/gen-license-code.mjs` produces `(code, hash)` pairs.
Hand the code to a buyer; paste the hash into
`VALID_LICENSE_HASHES` in `apps/web/src/lib/premium.ts`. Codes use
an unambiguous alphabet (no 0/O/1/I/L) so you can read them aloud
on the phone.

---

## Tester checklist (use this every time you hand the URL out)

Before sharing the URL, double-check:

- [ ] Tester's name + contact filled into `docs/tester-card.md`?
- [ ] Pricing decided? (If yes: set Stripe URLs in Vercel env. If no:
      keep the modal in "we're still figuring out" state — that's
      honest.)
- [ ] Discord URL set in Vercel env, if you want feedback in Discord?
- [ ] Read the focus-group stress test
      (`docs/focus-group-stress-test-2026-05.md`) for the open
      issues we deliberately deferred to round 3.

---

## Deferred to round 3

These came up in the focus-group stress test and are worth doing
later:

- **Photos to IndexedDB** — the localStorage 5 MB cap hits Linda's
  club-sized inventory. The current build detects the failure and
  warns; the proper fix is to move photos out of localStorage
  entirely.
- **JMRI export** — generate a JMRI PanelPro-compatible XML from a
  solved chain, so users who run their layouts via JMRI can import
  the geometry.
- **Voice input** — Web Speech API; older users who don't love
  typing on phones (handoff §1) would appreciate "say a piece label
  to add it".
- **Plan-import UI** — wire the `@trackfit/plan-import` package
  into a "Drop a plan" surface in Settings.
- **Real Anthropic Vision API call** — flip
  `VITE_USE_REAL_PHOTO_ID=true` and accept the per-photo cost.
  Requires a deployed Supabase edge function and an API key budget.

---

## Permission gates still in your court

Per handoff §9, these are explicitly Stephen's call:

- Final pricing (lifetime / monthly / once-only)
- Sharing the URL beyond approved scope (the original friend, plus
  the old-guy hobbyist tester you mentioned)
- Real Anthropic Vision API activation (~$0.50–1 per 30-photo
  validation run; ~$2–5 for the first 100 testers)
- Supabase Pro for cloud sync activation
- Adding analytics or tracking
- Any visual / palette / font change to the blueprint aesthetic
- i18n / localisation (Bob the German native flagged this)
