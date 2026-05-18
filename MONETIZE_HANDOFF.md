# Trackfit — Monetization & Showcase Handoff

**For: another Claude instance helping the owner (Stephen) figure out how to make money from this project or showcase the work.**
**Verified state: 2026-05-16. Live URL: https://trackfit.stevieweedseed.com/**

Read this end-to-end before recommending anything. Every fact below was verified against the repo on the date above, not recalled from memory.

---

## 1. One-paragraph product summary

Trackfit is a mobile-first, PWA-installable "field guide for sectional track" for model railroad hobbyists. Its killer feature is a **knapsack-style gap solver**: photograph or describe the gap in your layout, pick from your inventory, and get every combination of straights, curves, and turnouts that bridges the gap — plus a precise "you'd need a 2.5″ piece to close this exactly" near-miss suggestion when no exact fit exists. It started as a gift project for an older friend (the v1 user) and grew into a credible commercial product with a 16-system / 405-piece verified track library, a wired-up Claude Vision photo-ID pipeline, a freemium gate, and a deliberate blueprint/specimen aesthetic. The competitive landscape (AnyRail, SCARM, RailModeller Pro, XTrkCAD) is Windows-first, desktop-first, CAD-first, and universally described as having a "vertical cliff" learning curve — Trackfit deliberately is none of those things.

---

## 2. Build inventory (what actually exists — verified, not recalled)

### Repo shape
- **pnpm monorepo**, 1 app + 7 packages
- **Stack:** Vite + React 18 + TypeScript + Tailwind, PWA via vite-plugin-pwa, Vitest
- **~13,257 LOC in `apps/web` source alone** (TSX/TS) — components + hooks + lib
- **206 passing tests** (104 in packages + 102 in web)
- **Versions shipped:** v0.3.0 → v0.3.4 (5 published versions in one intense day, 2026-05-05) plus 11 days of polish since
- **CI/CD:** GitHub Actions → GH Pages with custom Hostinger CNAME, HTTPS auto-issued
- **License:** UNLICENSED (proprietary — important for monetization)

### Packages and what each does
| Package | Purpose | Notable details |
|---|---|---|
| `@trackfit/solver` | 1D subset-sum + curve solver + turnout v1 pathing | Wall-clock budget, feasibility pre-check, NMRA RP-11 minimum-radius warnings, near-miss intelligence |
| `@trackfit/library` | 16 track systems, 405 verified pieces, JSON schema with source citations + verification dates | Currently marked `data_quality: "unverified-draft"` pending a live re-verify pass |
| `@trackfit/measure` | Reference-object gap measurement (quarter, dollar bill, €1, £1, or "use a piece I own") | Browser-only, no native AR yet |
| `@trackfit/cut-templates` | 1:1 PDF cut templates for flex track + insurance-grade inventory PDF report | jsPDF; tile across US Letter and A4 |
| `@trackfit/layouts` | 20 layout templates with scoring + axes-short tiebreaker ranking | Powers the "build this with my inventory — what am I missing?" suggester |
| `@trackfit/marketplace` | Affiliate-link routing per piece (eBay, Trainz.com, hobby shops) | Per-piece brand attribution; "(N other brand pieces in this combo)" handling |
| `@trackfit/plan-import` | AnyRail XML reader → typed `PlanRequirement[]` → diff against inventory → `BuyListEntry[]` | 18 tests; hand-rolled regex parser (no XML dep) |

### Library breadth (the moat asset)
16 systems, 405 verified pieces total, with `source_url` + `source_verified_at` per piece:

```
Lionel FasTrack (O)              40 pieces
Kato Unitrack (N)                56 pieces   ← largest
Märklin C-Track (HO)             38 pieces
Bachmann E-Z Track (HO)          28 pieces
Märklin K-Track (HO)             28 pieces
Atlas HO Code 83                 27 pieces
Atlas HO Code 100                27 pieces
Kato Unitrack (HO)               25 pieces
Hornby OO Sectional              24 pieces
Atlas N Code 80                  23 pieces
Peco Setrack Code 100            20 pieces
Lionel O27 Tubular               15 pieces
Peco Streamline Code 100         15 pieces
Atlas O 21st Century/True-Track  14 pieces
Peco Streamline Code 83          14 pieces
Bachmann E-Z Track (N)           11 pieces
```

Competitor context: SCARM ships ~255 "libraries" that are "partially incomplete and unverified" (their own disclaimer). RailModeller ~290 with same caveat. Trackfit's 16 are deep, sourced, and dated. *Quality > quantity is the play here.*

### App-side surfaces shipped (28 components, partial highlights)
- **Onboarding flow** (306 LOC)
- **PiecePicker** searchable catalog modal (209 LOC) with kind-grouped picker, in-inventory chips, geometric-identity dedupe
- **LayoutSuggester** (762 LOC — biggest component) — picks layouts from `@trackfit/layouts` you can actually build today
- **ResultCard / ResultsList** (429 + 200 LOC) — with marketplace expander
- **GapCard** (365 LOC) — photo capture + reference-object measurement entry
- **SettingsMenu** (585 LOC) — preferences, units, Discord feedback, license activation
- **CandidateConfirmSheet** — low-confidence Vision UX (always-confirm-on-typed-label-mismatch rule)
- **PremiumModal + PremiumGate + PremiumPricingTest + LicenseActivation** — freemium scaffold + pricing-feedback collection
- **MarketplaceLinks**, **CutTemplateButton**, **PhotoButton**, **PhotoModal**
- **A11y rigor:** focus-trap hook (181 LOC), WCAG-sized 44×44px qty steppers, focus-group-derived empty states

### Infrastructure shipped
- **Cloudflare Worker** at `infra/cloudflare-worker/` — proxies Anthropic Vision calls so API key never reaches the client, with quota enforcement
- **Supabase edge function** at `supabase/functions/identify-piece/` — alternative photo-ID backend
- **GitHub Actions** deploy workflow → GH Pages
- **License code generator CLI** at `scripts/gen-license-code.mjs` — for issuing Premium keys

---

## 3. Quality signals (use these in a pitch / showcase)

These matter because they distinguish "AI slop project" from "real product":

- **206 tests passing** with named regression tests (e.g. `qty-default-regression.test.ts`, `pricing-feedback.test.ts`, `curve-integration.test.ts`)
- **Synthetic focus-group stress test** at `docs/focus-group-stress-test-2026-05.md` — six older-hobbyist personas (Walt 71, Margaret 68, Dennis 64, Frank 58, Bob 74, Linda 52) walked through five tasks each; 28 frictions logged with file:line citations and ranked fixes; **rounds 1 and 2 of those fixes are already shipped in v0.3.3 / v0.3.4**
- **Forensic changelog** at `docs/changelog.md` — per-release record of what shipped, what didn't, what tradeoff was made and why
- **Library audit report** at `docs/library-audit-2026-05.md`
- **Curve solver math doc** at `docs/curve-solver-design.md`
- **Plan-import notes** at `docs/plan-import-notes.md`
- **Photo-ID setup doc** at `docs/SETUP-PHOTO-ID.md`
- **Tester card** for first hobbyist beta at `docs/tester-card.md`
- **Hobbyist-precision rounding** explicitly fixed (commit `c4b5aa8` — "kill the 5.0207-inch CAD output") — design integrity over engineering laziness
- **Deliberate aesthetic system** — Fraunces serif headlines + IBM Plex Mono + signal-red accent + blueprint grid + specimen-frame photo corners. This is permission-gated against drift toward generic shadcn/Tailwind look.

---

## 4. Defensible / unique assets (the actual value)

Ranked by defensibility:

1. **The verified track-piece library (16 systems / 405 pieces with sourced citations).** Competitors' libraries are partial and unverified by their own admission. Combined with the photo-ID pipeline below, this is the compounding moat — every user who photographs a piece extends and verifies the library.
2. **The near-miss solver UX.** "You'd need a 2.375″ piece for an exact fit" is the single most actionable insight in this hobby and doesn't exist in any competitor as a focused tool. RailModeller's "Close Gap" feature gets roasted in App Store reviews specifically for *not* having this.
3. **Photo-ID activation path, fully wired.** Cloudflare Worker proxy + Supabase edge function + Claude Vision call + candidate-confirm UX + 3-photo-free quota + license activation flow + stub fallback. The only thing missing is "owner has signed off on paying for API calls in production."
4. **AnyRail plan-import → buy-list.** No mobile competitor has this. Hobbyists already have AnyRail/SCARM files of plans they want to build; Trackfit tells them what they're missing.
5. **The blueprint design system.** Identity-defining and well-executed; reads as a tool made by someone who cares, not a SaaS template. Hard to replicate without taste.
6. **1:1 PDF cut-template export.** Real differentiator for flex-track users.
7. **Layout suggester with axes-short tiebreaker.** 20 templates, scored against actual inventory. The "remix this layout" use case identified in the strategy doc as a Phase 4 vector — already shipped.

---

## 5. Monetization paths already scaffolded in code

Important: the code is *ready* for these — the business decisions are not yet made (the owner is intentionally validating before spending).

- **Freemium gate system** (`apps/web/src/lib/premium.ts`, 333 LOC) — gates photo-ID quota, PDF reports, marketplace tiers
- **Photo-ID quota** — 3 free identifications, then upgrade prompt
- **License activation flow** with code generator CLI
- **Pricing-feedback collection** (`PremiumPricingTest.tsx` + `lib/pricing-feedback.ts`) — A/B-friendly scaffold for testing price points
- **Marketplace affiliate links** per piece, with brand-aware routing
- **Insurance-grade inventory PDF** — RailScanPro charges separately for this; identified as a real revenue stream in the strategy doc
- **Premium "Coming Soon" guard** — when Stripe URLs aren't set, the modal shows calibrated "still figuring out a fair price" copy instead of broken buttons (focus-group fix)

Suggested pricing per strategy doc §8: **Free + Premium ($30/year or $99 lifetime)**. Free = solver + 50 inventory pieces + 3 photo-IDs. Premium = unlimited photo-ID + cloud sync + plan import + 1:1 cut templates + marketplace + PDF reports. Anchors against AnyRail's $59 price point.

---

## 6. Market context

### Market sizing
- **TAM:** ~300,000+ active model railroad hobbyists in North America + Europe (NMRA membership ~16k is the engaged tip of a much larger iceberg)
- **Demographic:** average age **56–64 and rising**; returning hobbyists with discretionary income; not early adopters
- **Trajectory:** hobby is shrinking in absolute terms (Hustle, 2024) but average spend rises and ScaleTrains-style premium brands are growing — finite TAM with rising ARPU

### Competitive landscape (full table, condensed)

| Tool | Platform | Price | Where it loses |
|---|---|---|---|
| **AnyRail** | Windows only | $59 | Windows-only, demo limit forces purchase fast, dated UI |
| **SCARM** | Windows | $44.90 | Windows-only, single maintainer (bus factor), "the friend who ruins your life" |
| **XTrkCAD** | Win/Mac/Linux | Free, OSS | "Manual reads like German→Japanese→English by someone who'd never seen a train" |
| **RailModeller Pro** | Mac only | ~$40 | Mac-only. Its Close Gap is the closest competitor to Trackfit's core feature — and gets roasted in App Store reviews for failing on sparse track systems |
| **3rd PlanIt** | Windows | $125 | "Avoid unless someone's teaching you personally" |
| **TrackPlanner.app** | Web (PWA) | Free beta | Genuinely modern, but slow library expansion (still missing Kato Unitrack as of 2026), still beta after 2+ years |
| **TrainDesign (iOS)** | iPad | $1.99 | One of the only iPad tools, but stale and poor geometry accuracy |
| **Atlas Right Track / Märklin / RR-Track** | Windows | $40 / paid | Brand-locked, Windows-only, abandoned-feeling |

**All incumbents share:** desktop CAD architecture pre-2010, "vertical cliff" learning curve, no mobile play, no AI, library-accuracy disclaimers.

### Adjacent precedent that matters
- **RailScanPro** — AI vision identifies *rolling stock* (locomotives/cars) from photos. Proves photo-ID works in this hobby and **users pay for it**. Does not cover track. Trackfit is the track equivalent.
- **JMRI** — open-source DCC control platform, the de-facto data interchange standard. Not a planning tool, but every serious hobbyist touches it. Future Trackfit export target.

### What hobbyists actually complain about (verbatim themes from forum research)
- **Brutal learning curve, universally.** *"Day 3: 'Maybe I should read the manual' / Week 2: 'I am become Track Geometry, destroyer of dreams.'"* — Hearns Hobbies review
- **Mac/iPad/mobile users are second-class.** *"There aren't any true S curves in this plan… I have a Mac Pro that I use most everything for except when I end up running Bootcamp Windows for SCARM and Anyrail."*
- **Close Gap is partial and flaky.** *"While the Close a Gap feature works well with some track systems like Atlas O, it does not work well at all with Gargraves. The latter requires extensive use of the 'saw' tool which is very tedious. **A 'cut-to-fit' tool would help.**"* — RailModeller Pro App Store review. **That last sentence is the entire Trackfit thesis in seven words.**
- **Library gaps kill the tool.** *"If you're running Kato Unitrack, you'll currently find no support [in TrackPlanner.app]."*
- **Software gets abandoned.** Easy Model Railroad Inventory, RRTrains2000, Atlas Right Track O 3R — users describe being "orphaned." **Data portability is a trust issue.**

### Distribution channel
**Model Train Forum, OGR Forum (O-gauge), Trains.com, Model Railroad Hobbyist** — these are where the audience lives. **NOT Reddit** — wrong demographic. The strategy of seeding the forums where the older hobbyist audience already discusses tools is non-negotiable; r/modeltrains skews 20 years too young.

### Positioning frame
**"Shazam of model railroad tracks."** Don't compete with AnyRail/SCARM as a CAD tool — be the focused mobile companion that lives next to the hobbyist on the basement floor. Same playbook as Shazam vs music libraries, Google Lens vs reverse image search, PictureThis vs botanical encyclopedias, Strava vs Garmin Connect.

Draft elevator pitch (testable):
> **Trackfit — the field guide for sectional track.** Photograph what's in your box. Photograph the gap. Get every combination that fits, exact or close, in seconds. No CAD, no learning curve, no desktop required. Built for the workbench, not the office.

Draft tagline: *"Lay it out before you lay it down."*

---

## 7. Honest gaps (what's NOT done — don't oversell)

Read these so the recommendation is grounded in reality:

- **Library is `data_quality: "unverified-draft"`** — geometry math hand-verified, but SKUs/source URLs need a fresh live re-verify pass before public marketing claims
- **Photo-ID is wired but not "on"** — the owner has a budget gate (`<$5`) on paid vision API spend until there's a sell signal. The stub returns fixed confidences; the real Anthropic call is one env-var flip away
- **Cloud sync schema designed but not deployed** — Supabase tables are in `supabase/migrations/`; the multi-device sync UX is not in the app yet
- **No real beta testers yet** — the synthetic focus-group test is a Claude-driven red-team, not real users. The friend (v1 user) is the only confirmed human user
- **No business-model decision made** — pricing, free tier limits, lifetime vs subscription
- **No payments wired** — Stripe URLs intentionally unset; current modal handles this gracefully
- **Curve solver perf** — has a known issue (older task #19) on stress-test inventories; wall-clock budget catches it but doesn't fix the underlying combinatorics
- **No App Store presence** — PWA only. Native iOS shell is Phase 3+ in the strategy doc

---

## 8. Two framings for the "money making" question

### Framing A — Showcase value (job / consulting / portfolio)

Best angles for showing this off as work product:

- **Hardware-meets-software product thinking.** Most "Claude built this app" demos are CRUD with a vibe. Trackfit is a real domain product with a hobby-specific killer feature, a verified data asset, and design integrity. That's rare.
- **Velocity demonstration.** v0.3.0 → v0.3.4 in one day, then 11 days of focus-group-informed polish. The forensic changelog reads like a senior engineer's release notes, not AI exhaust.
- **Test rigor.** 206 tests including named regressions. Easy to point to.
- **Multi-package monorepo architecture** done correctly — solver/library/measure/layouts/marketplace/plan-import are independently testable and importable into a future native shell.
- **Synthetic focus-group methodology.** The 6-persona stress test → ranked fixes → shipped rounds 1 and 2 is a *process artifact* worth showing on its own — it demonstrates the owner can use AI to compress user research.
- **Tasteful AI integration.** Photo-ID has a candidate-confirm sheet, confidence threshold, quota toast, never-clobber-typed-label rule. Most AI features ship as "magic button that lies." This one ships with epistemic humility built in.

### Framing B — Direct monetization paths

Ranked by effort × probability:

1. **Ship the freemium beta to the existing forum audience** (low effort, real signal). Distribute via Model Train Forum, OGR Forum, Trains.com — *not* Reddit. Validates whether the wallet matches the wishlist before any further spend.
2. **Sell the library as a data product / API.** The 16-system / 405-piece verified library with citation metadata is independently valuable. JMRI, AnyRail, SCARM, RailModeller could all license it. (Strategic risk: don't sell the moat too cheaply.)
3. **Affiliate revenue on marketplace links** — already wired. Zero ongoing engineering. Needs traffic.
4. **Insurance-grade collection inventory PDF** as standalone premium feature — RailScanPro charges separately for this; precedent exists.
5. **Acquisition target.** RailModeller is one developer. So is SCARM. Either could be an acquirer or a competitor-to-clone-this. Move fast on distribution before that becomes a risk.
6. **Adjacent-vertical pivot** (later) — same solver engine works for slot cars, Brio/Lego track, plumbing fitting, aquascape hardscape. Strategy doc §5 calls this out as Phase 4. Don't pivot until trains is won.
7. **Consulting/teaching the build process itself.** The synthetic-focus-group method, the multi-Claude monorepo dispatch, the permission-gated design system — these are reusable methodologies the owner could package and sell to other solo builders.

---

## 9. Hard constraints from the owner (read before recommending anything)

These are non-negotiable. Any recommendation that fights them is dead on arrival.

- **Audience is older (56–64 average).** Big touch targets, plain English, no jargon. Any monetization or showcase framing that requires "growth-hack" tone, dark patterns, urgency timers, or chat-bro positioning is wrong.
- **Budget constraint.** Owner won't sink more than ~$5 into paid APIs (vision, sync) without a sell signal first. Always propose UX scaffold + fake-door test before recommending real spend.
- **Aesthetic is permission-gated.** The blueprint/specimen design (Fraunces serif + IBM Plex Mono + signal red + railroad-blueprint grid + corner-tick photo frames) is intentional and does real work. Don't propose redesigns toward generic SaaS aesthetics.
- **Library accuracy is religious.** Get a track length wrong and the forums roast you within a week. Don't pitch claims about library completeness/accuracy without re-verification.
- **No Reddit.** r/modeltrains is the wrong demographic. The audience is on Model Train Forum, OGR Forum, Trains.com, Model Railroad Hobbyist forum.
- **No fake reviews, no fake usage numbers, no fake testimonials.** This started as a gift for someone's friend; integrity matters.
- **Owner-decision gates** (don't recommend autonomous action on any of these — they require explicit owner signoff):
  - Changing visual design system
  - Choosing a paid SaaS tier
  - Publishing publicly or to any app store
  - Adding analytics, tracking, third-party scripts
  - Adding ads or affiliate links beyond what's already wired
  - Business-model decisions (pricing tiers, free/paid splits)
  - Sharing the URL beyond the v1 friend-user

## 10. What the analyst Claude should do next

1. **Don't recommend "build X feature next."** That's not the question. The question is "monetize or showcase what exists."
2. **Verify any specific claim before quoting it.** This doc was written on 2026-05-16. Commits, LOC, test counts, library piece counts drift fast.
3. **Suggested deliverables** that would actually move things forward (pick based on owner's stated need — showcase vs revenue):
   - A 200-word pitch for posting to Model Train Forum / OGR Forum
   - A short demo-video script targeting the "photograph gap with quarter → exact piece combination" moment (explicitly identified as the most viral feature)
   - A pricing-test plan that uses the existing `PremiumPricingTest` scaffold and the freemium gate already wired
   - A portfolio writeup framing Trackfit as a senior-engineering case study (Claude-velocity + product taste + monorepo discipline + test rigor + tasteful AI integration)
   - A one-page sell sheet for the library-as-data-product angle (target: JMRI, AnyRail, SCARM, RailModeller as potential licensees)
   - A 30/60/90 day distribution plan that requires zero additional code — relies only on what's already shipped
   - A founder-story narrative ("built a gift for my older friend, turned into a product") — this has genuine pull and aligns with the audience demographic

---

*End of monetization handoff. The live URL https://trackfit.stevieweedseed.com/ is the only other thing you need.*
