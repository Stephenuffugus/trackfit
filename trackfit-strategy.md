# Trackfit — Competitive Landscape & Strategy

*Research compiled May 2026 from web sources, hobbyist forums (Model Train Forum, MRH, OGR Forum, Trains.com, RailModeller forum), App Store reviews, and trade publications. Reddit-specific search was rate-limited; the linked forum threads contain equivalent first-person hobbyist voice.*

---

## 1. The opportunity in one paragraph

Model railroading has roughly **300,000+ active hobbyists in North America and Europe** (NMRA membership ~16k is the engaged tip of a much larger iceberg), with an average age of **56–64 and rising**. The hobby's installed base of track-planning software is dominated by four tools — **AnyRail, SCARM, XTrkCAD, and RailModeller Pro** — all of which were architected before 2010, run on desktop computers, and are universally described by users as having "a learning curve that's not so much a curve as a vertical cliff face covered in grease." There is **no mobile-first, photo-driven, AI-augmented tool** in this market. The closest analog to Trackfit's gap-fill solver is a single buried feature in a Mac-only $40 desktop app that "doesn't work well at all" for half the track systems on the market. The friend's described pain point — *"I have these pieces, what can I build, and what's missing?"* — is real, universal, and **unsolved as a standalone product**.

---

## 2. Competitive landscape

### 2.1 Track-planning software (the incumbents)

| Tool | Platform | Price | Position | Where it loses |
|---|---|---|---|---|
| **AnyRail** | Windows only | $59 (50-piece free demo) | Easiest to learn of the desktop tools, broadest library | Windows-only, demo limit forces purchase fast, dated UI |
| **SCARM** | Windows (Wine on Linux) | $44.90 (75-track free) | Active dev (v2.0 Dec 2025), large user base | Windows-only, single maintainer (bus factor), described as "the friend who ruins your life" |
| **XTrkCAD** | Win/Mac/Linux | Free, open-source | Most powerful, only true cross-platform option | "Manual reads like German→Japanese→English by someone who'd never seen a train." Cryptic UI |
| **RailModeller Pro** | Mac only | ~$40 | Polished native Mac app, best-in-class library breadth | Mac-only. Its Close Gap assistant is the closest competitor to Trackfit's core feature |
| **3rd PlanIt** | Windows | $125 | Heavy-duty 3D | "Avoid unless someone's teaching you personally" |
| **Templot** | Windows | Free | Custom hand-laid track templates only | Specialist tool, brutal learning curve |
| **RR-Track** | Windows | Paid | Sectional-track focused | Another dated Windows tool |
| **Atlas Right Track** | Windows | $40 | Atlas-track focused | Atlas-only, Windows-only, abandoned-feeling |
| **Märklin Track Planning 2D/3D** | Windows | Paid | Märklin-only, German-only | Brand-locked |
| **Railroad-Professional** | Windows | Free/paid | Strong flex-track engine | Windows-only, German-first |
| **TRAX Editor** | Web | Free | Cross-platform, no install | Buggy (per user reports), data lock-in |
| **TrackPlanner.app** | Web (PWA) | Beta, free | Genuinely modern, mobile-capable | Slow library expansion (still missing Kato Unitrack as of 2026), still in beta after 2+ years |
| **TrainDesign (iOS)** | iPad | $1.99 | One of the only iPad design tools | Stale (last meaningful update years ago), poor reviews on geometry accuracy |

### 2.2 Inventory & roster apps

| Tool | What it does | Relevance to us |
|---|---|---|
| **RailScanPro** | AI vision identifies *rolling stock* (locomotives, cars) from photos. Reads reporting marks, manufacturer, model. Operations-focused (waybills, switchlists). | **Important precedent**: proves photo-ID via AI works in this hobby and users will pay for it. Does not cover **track pieces**. |
| **Model Railroad Inventory (iOS)** | Catalog rolling stock with photos, manual entry | Photo as ID, no AI. Inventory-first |
| **Model Railroad Consist (Android)** | Same | Same |
| **iCollect Everything** | Generic collection tracker with model train DB | Barcode-driven, generic |
| **Model Rail Inventory** (modelrail.app) | Cloud subscription inventory | Subscription model, web-based |

### 2.3 Operations / control software

JMRI (Java Model Railroad Interface) is the dominant open-source platform for *running* model railroads via DCC — programming decoders, building control panels, generating switchlists. It's been continuously developed since 1999 (currently v5.14) and has 25 years of community contributions. It is **not a planning tool** but is the de-facto data interchange standard — most planning tools export to JMRI's PanelPro format. Anyone serious in this hobby touches JMRI eventually.

### 2.4 Adjacent tools

- **Bob's Track Plans** — custom paid track-plan service (~$250/plan) by Bob Sprague. Competing with this is *not* the play; this is what people commission when they give up on the software.
- **trains.com Track Plan Database** — paywalled magazine archive of pre-made plans
- **freetrackplans.com / modelrailwayideas.com** — free plan galleries built on AnyRail/SCARM exports
- **Model Trains Simulator** — running simulator, not planning
- **ChatGPT / Claude direct use** — Trains.com itself published articles on hobbyists using LLMs as a "modeler's block" tool (April 2025). No purpose-built model-railroad LLM exists.

---

## 3. What hobbyists actually complain about

These are direct themes pulled from forum threads on Model Train Forum, MRH, OGR Forum, and App Store reviews:

### 3.1 The learning curve is brutal — universally
> "Hour 3: 'Why won't these pieces connect?' / Hour 6: 'I'll just watch one more tutorial...' / Day 3: 'Maybe I should read the manual' / Week 2: 'I am become Track Geometry, destroyer of dreams.'" — Hearns Hobbies review, Feb 2026

> "I tried XTrackCAD, it's free, but the interface was too cryptic for me." — repeated thousands of times in different words

This is structural. These tools were built by engineers for engineers and have never been redesigned for the hobbyist who *just wants to figure out their gap*.

### 3.2 Demographic mismatch
> "I get on with SCARM but not AnyRail" / "I can't get the hang of JMRI either so it's probably just me and my Alzheimers and Vascular Dementia"

The user we are explicitly designing for — the older hobbyist friend — is the *majority* user of this hobby. The current tools are built for a younger, more technical audience.

### 3.3 Mac/iPad/Mobile users are second-class citizens
> "There aren't any true S curves in this plan… I have a Mac Pro that I use most everything for except when I end up running Bootcamp Windows for 3 things, games to play online with my Son, SCARM and Anyrail."

> "A Mac version is not in the plans" — Atlas Track Planning Software

> "Most of what I've seen so far is not iOS friendly." — Model Train Forum thread on iPad track planning

### 3.4 The Close Gap feature is partial and flaky
This is the most important quote I found, from an App Store review of RailModeller Pro:
> "While the Close a Gap feature works well with some track systems like Atlas O which has half curves and various short straight sections, it does not work well at all with Gargraves which has longer curved sections and only a few straight lengths. The latter requires extensive use of the 'saw' tool which works but it is very tedious to get a 'cut' section the correct length to join within tolerance. **A 'cut-to-fit' tool would help.**"

That last sentence is the entire Trackfit thesis in seven words. The dominant Mac tool's gap-closer fails on sparse track systems and offers no guidance on what to cut. Trackfit's "missing piece" suggestion (already prototyped in v0.2) is the answer to this.

### 3.5 Data accuracy is only as good as the library
> "If you're running Kato Unitrack, you'll currently find no support [in TrackPlanner.app]." (as of 2026)

> "Some of the libraries are not fully completed. Data accuracy is not guaranteed." — SCARM's own disclaimer

A hobbyist whose track system isn't supported is dead in the water. Library breadth is non-negotiable.

### 3.6 Software gets abandoned
Easy Model Railroad Inventory, RRTrains2000, Atlas Right Track O 3R — multiple users describe being "orphaned" by their previous tracking app. **Data portability is a trust issue.**

### 3.7 The actual user journey is offline
> "Just start laying out track on the floor and see where it takes you. As mentioned, create 2 loops, see what you have left and expand them from there." — typical advice

The hobbyist's reality is: kneeling on the basement floor, a pile of track in front of them, a tape measure in hand, and a problem to solve. **None** of the desktop tools meet them where they actually are — and a phone in your pocket does.

---

## 4. The Trackfit angle: why this can be the best

The competitive map has a hole shaped exactly like Trackfit. Here is the strategic positioning:

### 4.1 Don't compete with AnyRail. Be the *Shazam* of model railroad tracks.
AnyRail and SCARM are CAD tools. They demand you sit down, learn the software, and build a layout from scratch. **Trackfit should not try to be a CAD tool.** Trackfit should be the **handheld, point-and-shoot companion** that lives next to the hobbyist while they work. Snap a photo, get an answer, get back to building.

This is the same playbook as:
- **Shazam** vs music libraries
- **Google Lens** vs reverse image search
- **PictureThis** vs botanical encyclopedias
- **Strava** vs Garmin Connect

In each case, a focused mobile experience with a superpower (audio fingerprinting, plant ID, social fitness) won massive share against bloated incumbents.

### 4.2 Five superpowers no incumbent has

Each of these is technically achievable today and would be a first in this hobby:

**1. Photo-ID for any track piece.**
RailScanPro proved AI vision works for rolling stock identification in this hobby. Track is *easier* — pieces have consistent geometry, manufacturer markings, and rail codes. A vision model trained on the ~5,000 distinct track pieces in production today could identify a piece from a phone photo in seconds and auto-fill its length, brand, and product code. **This eliminates the worst part of using existing tools: typing in your inventory.**

**2. AR / reference-object gap measurement.**
Lay a known object (a $1 bill, a track piece you own, a quarter) in the gap and photograph it. The app extracts the gap length to within a few millimeters. This is straightforward computer vision — there are no apps doing it for this audience yet. Future state: ARKit/ARCore plane detection to measure without a reference.

**3. The knapsack solver as the *primary* feature, not a buried assistant.**
RailModeller Pro's Close Gap is one menu item among hundreds. Trackfit makes it the front door. The "you'd need a 2.5″ piece for an exact fit" suggestion (already in v0.2) is the most actionable insight in this hobby and **does not exist anywhere else as a focused tool**.

**4. LLM-assisted design conversations.**
Hobbyists are already using ChatGPT/Claude manually for layout brainstorming (Trains Magazine, March 2025; german160.blog, April 2025). They're getting "underwhelming" results because the LLM lacks domain context. A purpose-built assistant with track libraries, NMRA standards, and prototype reference baked into context could give qualitatively better answers — e.g., *"Given a 4×8 ft space, your inventory of Lionel FasTrack, and your stated minimum radius of O36, here are three layouts you can actually build today."*

**5. 1:1 print-to-template for cuts.**
Hobbyists who need a non-standard length cut flex-track or rail with a saw. The app could generate a 1:1 PDF template — print it, lay it on the workbench, cut along the line. RailModeller Pro has a primitive version of this; nobody has done it well on mobile.

### 4.3 The data moat

The single biggest defensible asset in this space is **a complete, photo-rich, community-verified database of every track piece ever made.** SCARM has 255 libraries that are partially incomplete and unverified. RailModeller has 290 with the same caveat. Each one was built by a single developer typing in specs from manufacturer PDFs.

If Trackfit's photo-ID system *creates* the database as a side effect of users adding their inventory — and lets the community verify dimensions — it builds something the 30-year-old incumbents structurally cannot replicate. **The database becomes the moat. The app becomes the front-end to it.**

### 4.4 Community + remix
SCARM and RailModeller both have layout galleries. Neither has true "remix this layout" functionality the way Glitch or CodePen does. A hobbyist who finds a published layout should be able to one-tap *"Build this with my inventory — what am I missing?"* That's a feature only a tool with *both* the layout database *and* the user's inventory can offer.

---

## 5. Strategic feature roadmap

Each phase is structured so the *previous* phase's output stays intact and useful — older hobbyists especially do not tolerate apps that "evolve" by deleting the features they relied on.

### Phase 1 (where we are) — v0.2 prototype
Done: gap-fill solver, manual inventory, photos as visual mnemonic, near-miss suggestion, persistence.

### Phase 2 — "the obvious next moves" (v0.3 → v0.5)
Hand to Claude Code. ~2–4 weeks of work.

- **Curve solver.** The friend's described problem is straight-line gaps, but in practice many gaps are L-shaped or include an offset. A 2D solver that fits combinations of straights + curves to bridge a (length, lateral offset, angle) target.
- **Reference-object measurement.** User places a US dollar bill / known coin / known track piece in frame, app derives the gap length. No native AR yet — just OpenCV-style scaling.
- **Comprehensive verified preset library.** All major systems: Lionel FasTrack + Tubular + O27, Atlas HO + N + O, Kato Unitrack HO + N, Bachmann EZ-Track HO + N, Märklin C/K/M-Track, Peco Setrack + Streamline, Roco GeoLine, Rokuhan, Tomix, LGB, Hornby. Verified against manufacturer documentation. *This is grunt work but it is also the moat.*
- **1:1 cut templates.** PDF export of "cut here" lines for flex-track and rail.
- **Cloud sync + named saved inventories.** "My HO collection," "Loaner box from Dave," "Christmas tree layout."
- **Plan import.** Drop in an AnyRail / SCARM / XTrkCAD / JMRI file, get a buy list against your inventory.

### Phase 3 — "the AI superpowers" (v0.6 → v1.0)
This is where Trackfit becomes a category leader and not just a better tool.

- **Photo-ID for track pieces.** Vision API call (Claude or specialist model) that takes a piece photo and returns label/brand/length/product code. Train on the verified library from Phase 2.
- **AR gap measurement.** ARKit/ARCore plane detection — point camera at the gap, get a length without any reference object.
- **LLM design assistant.** "I have this much space, this inventory, I want to run long passenger cars. What can I build?" with context-rich prompts to a vision-capable model.
- **Community gallery + remix.** Publish layouts. One-tap "build this with my inventory."
- **Marketplace integration.** "You need a 2.5″ Atlas piece. Here are 3 sellers (eBay, Trainz.com, hobby shops with stock)." Affiliate revenue path.

### Phase 4 — "the platform play" (v1.0+)
Once the database and the user base are durable.

- **JMRI export** for users who want to control DCC layouts they designed in Trackfit.
- **Voice input.** Older users do not love typing. Whisper-based dictation for adding pieces, narrating a gap problem.
- **Insurance-grade documentation export.** RailScanPro charges for this; it's a real B2B-ish revenue stream for collectors with five-figure collections.
- **Club / shared inventory.** Modular layout groups (NMRA-standard modules, T-Trak, Free-mo) need shared planning. Multi-user editing.
- **Adjacent verticals.** The user mentioned scaling beyond trains. Same engine works for: slot car layouts, Lego/Brio kids' tracks, plumbing pipe-fitting, aquascape hardscape, model rocketry component fitting. *But that's a year away. Win trains first.*

---

## 6. Positioning & messaging

A draft elevator pitch, sharp enough to test:

> **Trackfit — the field guide for sectional track.**
> Photograph what's in your box. Photograph the gap. Get every combination that fits, exact or close, in seconds. No CAD, no learning curve, no desktop required. Built for the workbench, not the office.

A draft tagline: *"Lay it out before you lay it down."*

The audience to win first is the **returning hobbyist over 50** — the demographic that drives this market, has discretionary income, is tired of the existing tools, and is increasingly comfortable with smartphones. They are not on Reddit. They are on Model Train Forum, OGR Forum, Trains.com forums, and they read Model Railroader. **Distribution should target those communities, not r/modeltrains.**

---

## 7. Risks & honest concerns

- **The library is the moat AND the bottleneck.** Building a verified, photo-rich database of every track piece ever made is months of work. Without it, photo-ID hallucinates and gap-fill is approximate. *Mitigation: launch with the top 10 systems verified, crowdsource the long tail.*
- **Aging audience = slow adoption.** Older hobbyists are not early adopters. Trackfit needs to be aggressively simple and to leverage the 35-and-under-customer-average ScaleTrains demographic for early viral growth.
- **A defensive incumbent could clone the photo features in a year.** RailModeller Pro is one developer; if they wake up and copy this, they have library and user base advantages. *Mitigation: ship fast, lock in the database, build a mobile experience they cannot easily port.*
- **The hobby is shrinking in absolute terms** (Hustle, 2024) even as average spend rises. This is a finite TAM. *Mitigation: the adjacent verticals (slot cars, Lego, etc.) share the same engine. The first vertical proves the product, then we extend.*
- **Data accuracy in model railroading is religious.** Get a track length wrong and the forums will roast you. *Mitigation: every preset shows its source citation; users can flag and correct; the database becomes more accurate over time, not less.*

---

## 8. What I'd do next, if I were the friend

1. **Validate with five hobbyists.** Take v0.2 (the file we have today) to your friend and four of his model-railroad friends. Watch them use it. Don't explain — just observe. The pain points will be obvious and the priorities will rerank themselves.
2. **Decide the platform.** Web (PWA) keeps Trackfit cross-platform with one codebase but loses ARKit-quality measurement. iOS-native opens the AR superpower but doubles dev cost. *My bias: PWA for v1.0, native iOS for AR features in v2.0.*
3. **Lock in the vision-API integration.** This is the biggest single feature differentiator. The current v0.2 file has `TODO(vision)` markers. Wiring up Claude's vision API to the photo-capture flow is a half-day task and would make a single demo unforgettable.
4. **Verify the first 5 presets against manufacturer sources.** Lionel FasTrack, Atlas HO Code 83, Kato Unitrack N (already have). Add Bachmann EZ-Track HO and Märklin C-Track. Cite sources in code comments.
5. **Decide the business model**. Free + premium ($30/year or $99 lifetime) is the right shape. Free gets the gap solver and 50 inventory pieces. Premium gets photo-ID, cloud sync, plan import, 1:1 cut templates, marketplace integration. Match AnyRail's price point but undercut with mobile-first and AI.

---

## 9. Sources used in this research

(Selected, not exhaustive — full citations available on request.)

- AnyRail official site, anyrail.com
- SCARM official site, scarm.info
- XTrkCAD on SourceForge
- RailModeller Pro / Express, railmodeller.com + Mac App Store reviews
- TrackPlanner.app blog (Beta 1–12)
- Innovative Hobby Supply: "Free Model Train Track Planning Software" (Feb 2026), "Track Planning Software: Where Dreams Go to Die" (Hearns Hobbies, Feb 2026)
- Trains Magazine: "ChatGPT and the model railroad" (March 2025), "ChatGPT use cases for the model railroader" (Dec 2024), Layout-design software review (Garden Railways, Nov 2020)
- Model Train Forum threads: track planning resources, AnyRail vs SCARM, RailModeller closing gaps, iPad software, club model railroading
- O Gauge Railroading Online Forum: aging demographics, RailModeller help, free track planning software
- MRH Forum: best railroad design software, easements, top 10 track planning
- The Hustle: "How the model train industry got off track" (Jan 2024)
- Saturday Evening Post: "Model Railroading Gains Steam" (Oct 2022)
- NMRA Beginners Guide Part 2 (Layout Planning, Dec 2024) and Part 4 (Laying Track, May 2022)
- RailScanPro feature documentation, railscanpro.com
- BYMRR Train Store: "How to Use AI to Design Your Model Railroad Track Plan" (Jan 2026)
- Forum quote: RailModeller Pro App Store user review on Close Gap + Gargraves limitation

---

*End of strategy document. Hand this to Claude Code along with `trackfit.html` v0.2 to begin Phase 2 implementation.*
