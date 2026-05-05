# Trackfit — Claude Code Handoff

You are taking over a project called **Trackfit**, a mobile-first track-fitting tool for model railroad hobbyists. A working v0.2 prototype exists as a single-file HTML app. Two strategy documents and that prototype have been handed to you. Your job is to take Trackfit from "single-file prototype" to "shippable public beta of a real product." You have a Claude Max plan and explicit permission to dispatch as many parallel subagents as the work warrants — please do, the budget is not the constraint here.

This document is everything you need to start. Read it once end-to-end before writing any code. Then proceed.

---

## 1. The human dimension

Trackfit started as a gift project. The person directing the work has an older friend — a lifelong model train hobbyist — who described a problem he and every hobbyist he knows runs into constantly: *I have a pile of track pieces and a gap in my layout. What can I build with what I have? What's missing?* The friend explicitly framed it as a knapsack problem. The first draft was a blueprint-aesthetic web app that solves exactly that, with photos as a mnemonic so older eyes don't have to squint at fine print labels.

Two things follow from this that should color every decision you make:

**The audience is older.** Average age in this hobby is 56–64. They are returning hobbyists with discretionary income, not 20-something early adopters. They do not love typing on phones. They do not tolerate vertical-cliff learning curves. They are the people every existing tool has failed. **Big touch targets, forgiving inputs, plain-English copy, no jargon, no magic gestures.**

**This needs to feel made-with-care, not made-by-AI.** The blueprint/specimen aesthetic of v0.2 — Fraunces serif headlines, IBM Plex Mono for technical text, the railroad-blueprint grid background, the corner-tick photo frames — is doing real work. Preserve it. When you add new surfaces (modals, settings, sync flows), they should feel like they came out of the same drafting kit. Don't quietly drift into a generic shadcn/ui or Material aesthetic.

---

## 2. What you're inheriting

Files in this handoff:

```
/mnt/user-data/uploads/trackfit.html              # v0.2 prototype, single file, ~880 lines
/mnt/user-data/outputs/trackfit.html              # same v0.2 file in outputs
/mnt/user-data/outputs/trackfit-strategy.md       # competitive landscape & roadmap
/mnt/user-data/outputs/CLAUDE_CODE_HANDOFF.md     # this document
```

Read the strategy doc before starting. The competitive findings shape the roadmap; the phrase "Shazam of model railroad tracks" is the north star. Do not try to build a competitor to AnyRail or SCARM — those are CAD tools. Trackfit is a focused, photo-driven, mobile companion that lives next to the hobbyist on the basement floor.

What v0.2 already does, well:
- Bounded subset-sum solver with overshoot pruning (pure JS, ~50 lines, fast for typical inventories)
- Near-miss intelligence: when no exact fit exists, identifies the best under-target combo and tells the user *exactly* what single piece length would close the gap. **This is the killer feature.** Do not regress it.
- Photo capture per inventory piece + per gap, with auto-resize to 1200px JPEG ~82% quality, stored as base64 in localStorage
- Three verified track library presets: Lionel FasTrack (O), Atlas HO Code 83, Kato Unitrack (N)
- localStorage autosave (debounced 250ms), preset detection on load, reset flow with confirms
- Mobile-responsive layout that stacks inventory rows on screens <520px

The code has explicit `TODO(vision)`, `TODO(measure)`, and `TODO(curves)` markers showing exactly where the next-generation features wire in. Honor those entry points — the data structures and UI flows already accommodate them.

---

## 3. Strategic direction (read once, internalize)

The five superpowers that make Trackfit a category leader, not just a better tool:

1. **Photo-ID for track pieces.** Snap, identify, auto-fill. RailScanPro proved this works for rolling stock; nobody has done it for track yet.
2. **Reference-object / AR gap measurement.** Photograph the gap with a known object in frame; derive length. Eventually ARKit/ARCore.
3. **The gap solver as the front door.** Not a buried CAD assistant.
4. **LLM design assistant with track-domain context.** "I have this space, this inventory, these constraints — what can I build today?"
5. **1:1 print-to-template cut guides.** Hobbyists already cut flex track with razor saws; help them cut it accurately the first time.

The single most defensible asset is **a complete, verified, photo-rich database of every track piece ever sold**. SCARM and RailModeller both have ~250-290 library files that are partial, unverified, and built by single maintainers typing in specs. If Trackfit's library becomes the most accurate and the photo-ID system *creates* it as a byproduct of usage, the moat compounds with every new user.

That has a concrete implication for Phase 2 priorities: **library completeness is not glamorous, but it is the moat.** Treat it accordingly.

---

## 4. Architecture decision

You inherit a single HTML file. That was correct for v0.1–v0.2. It is not correct for the next phase. Here is the recommended stack and the reasoning. You may override this, but if you do, document why.

**Recommended stack:**
- **Vite + React + TypeScript** for the app shell. Vite gives instant HMR; React's component model is the right size for the UI complexity coming; TS catches the inevitable bugs in unit conversions, recursion bounds, and JSON schemas. A small surface, no framework overreach.
- **PWA from day one.** Service worker, web manifest, install-to-home-screen. The audience deserves an icon on their phone, not a bookmark.
- **Tailwind for utility classes**, but with a **custom theme file that ports the blueprint design tokens** from the v0.2 CSS. Do not ship default Tailwind aesthetics. The `--bg`, `--ink`, `--accent`, the Fraunces/IBM Plex pairing, the specimen-frame photo borders — all of that gets translated into theme tokens and component primitives.
- **Supabase for sync** (Postgres + Auth + Storage). Fastest path to magic-link auth, anonymous device IDs, and image storage. Free tier is plenty for the beta.
- **Anthropic Claude API** for vision (track-piece identification) and the design assistant. Use `claude-opus-4-7` for vision-quality identification; `claude-sonnet-4-6` for the chat assistant where latency matters. Server-side proxy, never expose the API key to the client.
- **Vercel** for deployment. PWA deploys cleanly, preview branches work for sharing builds with the friend.
- **Vitest** for unit tests of the solver. The recursive subset-sum logic deserves real test coverage; a regression there is the worst possible bug.

**Repository structure:**
```
trackfit/
├── apps/
│   └── web/                      # Vite + React PWA
├── packages/
│   ├── solver/                   # pure-TS subset-sum + (later) curve solver
│   ├── library/                  # track-piece JSON data + types
│   └── ui/                       # shared design system (blueprint aesthetic)
├── server/                       # API routes for vision proxy, sync, AI assistant
└── docs/                         # architecture decisions, library source citations
```

A monorepo (pnpm workspaces) is overkill for v0.2 but the right shape for the work coming. The solver and library should be independently testable and importable into a future native iOS app without dragging the web UI along.

**Migration plan from v0.2:** Do not throw the file away. Keep it as `apps/web/legacy/trackfit-v0.2.html` for reference. The HTML file is the *spec* for v1.0's appearance and behavior — match or improve every existing feature. Port carefully; do not "redesign while we're at it."

---

## 5. Phase 2 work streams (parallelize aggressively)

The work below is structured into seven tracks, six of which can run in parallel after Track 0 lands. **Dispatch at least four subagents simultaneously** for the parallelizable work — the strategy doc explicitly notes the budget is not the constraint.

### Track 0 — Foundation (sequential, blocks others)

Estimated: 1–2 days of focused work.

Set up the monorepo, pick deploy target, port v0.2 to React + TS while preserving exact visual fidelity, ship a private preview URL. Definition of done: open the preview URL on a phone, every v0.2 feature works identically, design tokens match pixel-for-pixel, lighthouse PWA score ≥90, deployed to a private Vercel URL the human can share with the friend.

Specifically:
- Set up Vite + React + TS in `apps/web` with the structure above
- Extract the v0.2 CSS variables into a Tailwind theme + a small set of CSS custom properties for things Tailwind handles badly (the blueprint background grid, the specimen-frame `::before`/`::after` corners)
- Port the solver into `packages/solver` with TypeScript types, write 8–12 unit tests covering: exact fit, tolerance match, near-miss-under, near-miss-over, no-solution, empty-inventory, all-zero-quantities, and the specific case where a fitter piece (e.g. 1.375") closes a gap requiring 4 pieces
- Port the library data into `packages/library` as JSON files, one per track system
- Port the UI: header, preset chips, inventory rows (with photos, mobile stacking), gap card (with photo), solve button, results cards, photo modal, near-miss SUGGESTED callout — preserving every detail
- localStorage persistence preserved exactly. Add a feature flag for cloud sync (off by default in this track)
- PWA manifest + service worker + offline fallback page that retains brand
- Deploy preview URL

When this lands, branch out.

### Track 1 — Verified track library expansion (parallelizable into 6 sub-agents)

Estimated: 1–3 days of research and JSON authoring per system, parallelizable. **This is the moat work.**

The current library has 3 systems. The shippable beta needs at least these 12, in this priority order:

1. **Lionel FasTrack (O)** — already in v0.2, verify against Lionel's current catalog, add curves and turnouts
2. **Lionel O27 Tubular** — large boomer audience, no good app library exists
3. **Atlas HO Code 83** — already in v0.2, expand
4. **Atlas HO Code 100** — separate library
5. **Atlas N Code 80** — sister product
6. **Atlas O 21st Century / True-Track**
7. **Kato Unitrack (N)** — already in v0.2, expand to all S/R/V variants
8. **Kato Unitrack (HO)** — separate library
9. **Bachmann EZ-Track HO** — huge install base, train-set default
10. **Bachmann EZ-Track N**
11. **Märklin C-Track (H0)** — dominant European 3-rail
12. **Märklin K-Track (H0)** — older, still huge collector base
13. **Peco Setrack Code 100** + **Streamline Code 100/83** (UK/European default)
14. **Hornby OO** (UK starter-set default)
15. **Roco GeoLine (H0)**, **Tomix Fine Track (N)**, **Rokuhan (Z)**, **LGB (G)** — long-tail, lower priority

**Dispatch this as 6 parallel subagents**, each owning 2–3 systems. Each subagent should:

1. Search for the manufacturer's official current product catalog or technical PDF (do not rely on hobbyist forum posts as primary source)
2. Extract every straight piece, every curve (radius + arc angle), every turnout (frog number, length, divergence angle), every crossing
3. Record canonical product code, the manufacturer's name, length in mm (curves: radius_mm + arc_degrees), and a verified source URL
4. Output to `packages/library/data/{system-id}.json` in this schema:

```ts
type TrackPiece = {
  id: string;              // stable, e.g. "lionel-fastrack-10in-straight"
  product_code: string;    // manufacturer's SKU, e.g. "6-12014"
  label: string;           // display name
  kind: "straight" | "curve" | "turnout" | "crossing" | "fitter" | "flex";
  length_mm: number;       // for straights/fitters; for curves: arc length
  radius_mm?: number;      // curves only
  arc_degrees?: number;    // curves only
  // turnouts/crossings have richer geometry — see types.ts
  source_url: string;      // citation
  source_verified_at: string;  // ISO date
  notes?: string;
};

type TrackSystem = {
  id: string;
  name: string;
  manufacturer: string;
  scale: "Z" | "N" | "TT" | "HO" | "OO" | "S" | "O" | "G";
  default_unit: "in" | "mm";
  pieces: TrackPiece[];
};
```

5. For each system, also write a short markdown note in `docs/library-notes/{system-id}.md` explaining what was verified, what was inferred, what was uncertain, and where doubt remains. **The community will eventually crowdsource verification; we want our gaps documented.**

**This is the most important deliverable in Phase 2.** A wrong length here will be roasted on Model Train Forum and OGR Forum within a week of beta. If a manufacturer's spec is unclear, write the JSON entry as `null` for the uncertain field and document why — empty is honest, wrong is fatal.

### Track 2 — Curve solver (single dedicated agent, complex)

Estimated: 3–5 days.

The v0.2 solver is 1D: find piece combinations summing to a target length within tolerance. The real-world gap-fill problem is often 2D: bridge a (longitudinal_length, lateral_offset, angular_change) target using straights and curves.

Build a curve-aware solver in `packages/solver` that takes:
- Target: `{length_mm, lateral_offset_mm, angle_degrees}`
- Inventory: `TrackPiece[]` (mix of straights, curves, fitters)
- Tolerance: per-axis

And returns ranked combinations. Use the same near-miss philosophy as v0.2: when no exact fit exists, surface the closest viable combo plus a precise "missing piece" suggestion.

Mathematical reference:
- NMRA RP-11 (Curvature & Rolling Stock) — minimum radii guidance per scale
- A curve piece contributes `(2 × radius × sin(arc/2))` chord length and `arc` degrees of angular change; lateral offset is derived
- Easements (transition curves) are out of scope for this track — punt to a Phase 3 module
- Search space pruning: bound by maximum reasonable angular sum (typically ≤ 360°) and length sum (target_length × 1.5 + tolerance)

Acceptance tests:
- Pure-straight gap: must match v0.2 solver bit-for-bit
- 90° corner with two pieces of 22"-radius curve in HO: should solve cleanly
- An S-curve gap (straight, then curve, then opposite curve, then straight): should find combinations
- Reverse-loop closure: should solve with valid combinations including curves
- Performance: ≤ 200ms for inventories of ≤ 20 piece types and ≤ 30 qty each

Document the math in `packages/solver/CURVES.md` so a hobbyist with no programming background can verify the formulas if they want to.

### Track 3 — Photo-ID via Claude Vision (single agent, foundational)

Estimated: 2–3 days.

Wire Anthropic's vision API to the existing photo-capture flow. The v0.2 file has a `TODO(vision)` marker showing the integration point.

Implementation:
- Server-side endpoint `POST /api/identify-piece` accepting a base64 image, returning `{brand, system, label, length_mm, product_code, confidence}`
- Use `claude-opus-4-7` for image quality on track piece identification; the geometric features (rail spacing, sleeper count, brown/black/grey ballast color, integrated roadbed shape, packaging logos when visible) are subtle and need the better model
- System prompt: ground the model in the verified library data from Track 1 — pass it the list of known systems and pieces so it returns canonical product codes, not free-form descriptions
- Confidence threshold: if Claude returns confidence < 0.7, show the user the top 3 candidates and ask them to confirm. Never silently auto-fill low-confidence guesses.
- Cache: same image hash → cached response. The audience will photograph 50 of the same kind of straight track in a row.
- UI: when the user taps an empty photo button, after capture and resize, show a brief "Identifying…" state, then either auto-fill the row or show the candidate-confirm sheet

Important: **never block the user.** If identification fails or is slow, the existing manual-entry flow stays available. The photo-ID is augmentation, not a gatekeeper.

Quality bar: on a held-out test set of 30 photos across 8 track systems, top-1 accuracy should beat 75%, top-3 should beat 92%. If you can't hit this, *don't ship it as auto-fill* — ship it as "tap photo to suggest" and let the user pick.

### Track 4 — Reference-object measurement (single agent, novel)

Estimated: 3–4 days.

The v0.2 file has a `TODO(measure)` marker. The feature: photograph a gap with a known reference object in frame (US dollar bill, US quarter, a track piece the user owns), tap the reference and the gap endpoints, get the gap length to within a few mm.

Approach:
- Browser-only, no native AR for v1 (ARKit comes later in a native iOS shell)
- After capture, show the photo with two interactive overlays:
  1. Reference object: user picks from a small list (Bill, Quarter, "use one of my tracks"), then drags two endpoints to mark its known dimension
  2. Gap: drag two endpoints to mark the gap edges
- Compute pixel-distance ratio, derive gap length, populate `targetInput`
- Show the user the inferred number with a "looks right?" confirmation before committing

Reference dimensions to support out of the box:
- US dollar bill: 156mm long
- US quarter: 24.26mm diameter
- Euro 1€ coin: 23.25mm
- UK £1 coin: 23.43mm
- "Use a piece I own": user selects an existing inventory piece by photo

This feature is cosmetically simple but it is the most viral one. A 30-second demo video — *photograph gap with quarter, get exact piece combination* — is the hook that gets older hobbyists to download the app. Do it well.

### Track 5 — Cloud sync + saved inventories (single agent)

Estimated: 2–3 days.

The friend should be able to use Trackfit on his phone in the basement and on his laptop on the train, without losing his inventory. Photos must sync.

Stack: Supabase (Postgres + Storage). Auth: magic-link email *and* anonymous device-ID fallback (so the user can use the app immediately without signing up; sync becomes available when they add an email later).

Schema:
```sql
inventories(id, user_id, name, created_at, updated_at)
inventory_pieces(id, inventory_id, label, length_mm, qty, photo_url, created_at, updated_at)
gaps(id, inventory_id, target_mm, tolerance_mm, photo_url, created_at)
```

Photos go to Supabase Storage, not as base64 in Postgres rows. Client uploads on photo capture, stores the URL.

Conflict resolution: last-write-wins per row, with a debounce. Two devices editing the same row = the later edit clobbers; not perfect but acceptable for a single-user-multi-device tool. Real CRDTs are over-engineering for this audience.

Multiple named inventories: "My HO collection", "Loaner box from Dave", "Christmas tree layout". Switcher in the header. **This unlocks the modular-club use case** which the strategy doc identified as a Phase 4 expansion vector — laying the schema down now costs nothing and avoids a migration later.

Privacy note: photos may inadvertently capture identifying details (basements, faces, etc.). Default photo storage to private (signed URLs only); never make user inventories public unless explicit "share to gallery" action.

### Track 6 — 1:1 cut templates (PDF export, single agent)

Estimated: 1–2 days.

For when the gap solver says "you'd need a 2.375" piece for an exact fit" and the user has flex track they can cut.

Generate a PDF with 1:1 scale cut lines:
- Inputs: chosen flex piece type, target length
- Output: PDF with the exact-length region marked, tile across multiple pages if needed (US Letter and A4 supported)
- Include trim guides and registration marks so the hobbyist can tape the pages together accurately
- Print test: actually print one of these on a real printer and measure with calipers. If it's off by even 1mm, fix the unit conversion bug — this is the kind of thing forums roast you for.

Use jsPDF or react-pdf. Server-side rendering preferred for accuracy.

---

## 6. Quality bar — what "shippable beta" means

The work above lands you at v1.0 beta when:

1. The friend can install Trackfit to his phone home screen
2. He can add 30 inventory pieces using the camera (not by typing) in under 10 minutes
3. He can photograph any reasonable gap with a quarter in frame and get a length to within 5mm
4. The solver finds combinations including curves, not just straights
5. His inventory syncs between his phone and his laptop
6. When no combination fits, he gets the precise "you'd need a piece this long" suggestion (not a regression from v0.2)
7. He can print a 1:1 template for a flex-track cut and it's accurate
8. The 12 priority track libraries are present, verified, sourced
9. The PWA scores ≥90 on Lighthouse mobile
10. The blueprint aesthetic is preserved end-to-end

If at any point a feature you're building forces a regression of an existing v0.2 capability, **stop and ask**. The user will not forgive losing the near-miss suggestion or the photo mnemonic in service of a fancier feature.

---

## 7. Pre-flight verification (do before writing code)

These are research tasks. Dispatch them in parallel before the Track 0 work begins so the answers are in context when implementation starts.

1. **Confirm Anthropic API access pattern.** Read `https://docs.claude.com` for current vision API usage, rate limits, pricing per image. Confirm `claude-opus-4-7` is available for vision. Document the per-photo cost so the human can budget for it.
2. **Confirm Supabase free-tier limits** for storage and rows; document the upgrade path price point.
3. **Spot-check three track-system catalogs** to verify the library research approach will produce clean data. Try Lionel FasTrack, Märklin C-Track, and Kato Unitrack — these are the three most-likely-to-be-difficult sources. If any of them require manual catalog scraping with no programmatic source, flag it now and we'll budget more time.
4. **Find or build a small held-out photo dataset** for vision evaluation — 30 track-piece photos across at least 6 systems. eBay listings and hobby-shop product pages are good sources. This is needed for Track 3's accuracy gate.

---

## 8. Don'ts and traps

Things you will be tempted to do that you shouldn't:

- **Don't redesign the UI "while you're porting it."** The v0.2 design is intentional. If you genuinely think something is broken, raise it as a separate issue and let the human decide.
- **Don't add a 3D layout view.** Every existing tool has one. None of them are why hobbyists keep them or leave them. Trackfit is not a CAD tool.
- **Don't add user-facing curve easement / superelevation features in this phase.** It's a real hobbyist concern but it's a Phase 3 module. Keep the curve solver to circular arcs for now.
- **Don't ship vision auto-fill if accuracy is below the 75%/92% bar.** Fall back to candidate-confirm. A wrong auto-fill teaches the user to distrust the app forever.
- **Don't store photos as base64 in Postgres rows once cloud sync exists.** It's tempting because the local code already does it. Migrate to Supabase Storage.
- **Don't break the offline experience.** Every feature should degrade gracefully when offline. The hobbyist's basement may not have great wifi.
- **Don't expose API keys to the client.** All Claude/Anthropic calls go through your server.
- **Don't generate fake user reviews or fake usage numbers anywhere.** This is a gift for someone's friend; integrity matters.
- **Don't assume Reddit/r/modeltrains is the audience.** It's not. The audience is on Model Train Forum, OGR Forum, Trains.com, and Model Railroad Hobbyist forum. Distribution will be through those communities and through clubs.

---

## 9. Permission gates — ask the human before you do these

Most decisions are yours. These are not.

- Changing the visual design system (colors, fonts, the blueprint aesthetic)
- Choosing a paid SaaS tier (Vercel Pro, Supabase Pro, etc.)
- Publishing the app publicly or to any app store
- Sharing the URL with anyone other than the friend
- Adding any analytics, tracking, or third-party scripts
- Adding ads or affiliate links
- Decisions that affect the business model (free/paid tiers, pricing)
- Any deviation from the recommended stack that costs more than a day of rework
- Asking the friend or any user for personal information beyond email-for-magic-link

When in doubt, ask. The human is on a Max plan and is reachable.

---

## 10. Suggested first-day dispatch plan

When you start work, the optimal parallel structure is:

**Hour 0** — read this document, the strategy doc, and the v0.2 file. Resolve open questions in the pre-flight verification section by dispatching 4 research subagents in parallel:
- Subagent A: Anthropic API confirmation
- Subagent B: Supabase tier confirmation
- Subagent C: Track catalog accessibility spot-check
- Subagent D: Vision photo dataset assembly

**Hour 1–2** — write a brief technical-design document (`docs/architecture.md`) confirming the stack choice, the schema, the routing structure, the build pipeline. Commit.

**Hour 2–end of day 1** — Track 0 (foundation port). This is sequential. You cannot parallelize the initial scaffold.

**Day 2 onward** — fan out into 6 parallel tracks:
- 6 sub-agents on Track 1 (track library — one per group of systems)
- 1 sub-agent on Track 2 (curve solver)
- 1 sub-agent on Track 3 (vision)
- 1 sub-agent on Track 4 (reference-object measurement)
- 1 sub-agent on Track 5 (cloud sync)
- 1 sub-agent on Track 6 (cut templates)

Track 1 (library) and Track 5 (sync) have a coordination point — sync needs the schema, library needs the schema. Settle the schema in `packages/library/types.ts` on day 2 morning before fanning out.

Tracks 2, 4, and 6 are math/geometry-heavy. The same subagent could batch them sequentially if parallel capacity matters.

**End of week 1** — internal demo to the human. Run through the friend's actual use case end-to-end. Decide what's blocking beta.

**End of week 2** — beta-ready build. Deploy to a private URL. Hand to the friend. Watch him use it. The first five minutes of him using it will reorder your remaining priorities more than any spec ever could.

---

## 11. A note on tone

Treat this codebase like you'd treat a piece of furniture you're building for someone you love. The code is read more than written; readable, well-commented code is a kindness to whoever (probably another instance of you) maintains it next. Comments explaining *why*, not *what*. Tests for the parts that would silently break. Commit messages that someone reading the log in two years will understand.

The v0.2 file is a small example of this — it has a header explaining the project, it has TODO markers explaining the next-generation features by name, it has comments explaining the solver's pruning logic. Match that bar.

When you finish a track, write a short note in `docs/changelog.md` explaining what shipped, what didn't, what tradeoffs you made. This is not for marketing. It's so that next month when the human asks "did we end up using clothoid spirals or simple arcs?", the answer is in the repo.

---

## 12. The single most important thing

The friend has been waiting his whole hobbyist life for a tool that solves this problem. Existing tools have failed him not because the problem is hard but because no one focused on it. Trackfit's reason for existing is that *focus*.

If you're ever uncertain whether a feature belongs, ask yourself: does this help an older hobbyist sitting on his basement floor at 9pm with a pile of track in front of him and a gap to fill? If yes, build it. If no — even if it's clever, even if it would be a fun engineering challenge, even if every other tool has it — leave it for later.

Good luck. Build something he'll love.
