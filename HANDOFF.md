# Trackfit: the perfecting pass (branch `perfect-nov14`, 14 Nov 2026)

Built by an Opus builder while Stephen was travelling. Nothing was
deployed. `main` and the live site at trackfit.stevieweedseed.com are
untouched. Every commit on this branch has been pushed to GitHub.

## What changed, in plain words

1. **Free and honest.** The $19 Founder licence is gone, and so is "photo
   ID". That feature invented a piece and quietly filled it into your list.
   Everything that sat behind the paywall is now open to everyone. Fonts
   are self-hosted, so the app makes no network requests of its own. (These
   are the two patches parked in August. They applied cleanly. The only
   change is that the `deploy.yml` edit was kept out, see below.)
2. **"What can I build?" now gives a real answer.** Step 3 finds complete
   loops (circles and ovals) using only the pieces you own. It uses one
   brand and one curve size per loop, makes the two straight sides match,
   and never uses more of a piece than you have. Each loop gets:
   - a drawing, piece by piece, with ticks where the pieces join;
   - the table space it needs, in feet and inches or metres;
   - the list of pieces to take out of the box;
   - the order to lay them, leg by leg;
   - a "Print this plan" button.

   You can give it your table size, and then it only shows loops that fit.
   If no loop is possible it explains how far short you are ("your best
   curve size covers 330 degrees, you are 30 degrees short"). The old
   "What can I build" list compared totals only, and its "Build this"
   button did nothing. It stays as "More layout ideas (a rough guide)" and
   now says it is rough.
3. **Faster to enter your box.** The brand is one dropdown grouped by scale.
   Before, 16 big buttons filled the whole first screen. Each catalogue
   piece is now two lines: its full name and a count with large − and +
   buttons. Before, it was four lines with the name cut off mid-word. New
   buttons: "All counts to 0" (it can be undone) and an "I own" filter.
4. **Curved gaps work.** The gap filler measured curved gaps wrongly.
   Example: a 30° gap the exact size of one 18" curve came back "no exact
   fit, short 0.44"". The geometry is fixed and tested. The field label now
   says "Straight line, rail end to rail end" instead of "Chord length".
   Leaving out the length or the turn now gives a plain message. Before, it
   said "nothing comes close" and the solve clock kept running.
5. **Built for older eyes and hands.** No text on the main screens is under
   14 px. Inputs are 16 px, so iPhones do not zoom in. Touch targets are
   48 px. Keyboard focus outlines are back. Input borders are now readable.
   "Bigger text" used to promise 25% and deliver about 6%; it now enlarges
   the whole page by 20%. Results read "3 ways to fill the gap" instead of
   "3 solutions · solved in 4.2ms". The welcome cards describe what the app
   now does. The footer says where backup, print and bigger text live (the
   gear).
6. **Names.** "Sky Wolf Studio" appears in the footer, meta tags, PDF footer
   and printed plans. The old parent company's name is gone from everything
   a user can see. The report email now goes to stephen@skywolfstudio.com.
   The CNAME is untouched (see the domain steps below).
7. **Ready to install.** The manifest has an `id`, PNG icons 192 and 512, a
   maskable 512 and a PNG apple touch icon. The new icon is an oval of
   track drawn the way the app draws loops. A privacy page
   (`/privacy.html`) says what is stored, and where, based on reading the
   code. Cold start with the network off works.
8. **Store kit draft in `store/`.**
   - `LISTING.md`: name, short and full description, Data safety answers.
   - `PLAY-READINESS.md`.
   - Six phone screenshots from the real app (1082 x 1922).
   - A feature graphic made from the app's own loop drawing.
   - The 512 icon.
9. **Clean-up.** The old v0.2 single-file copy at the repo root
   (`index.html`, `trackfit-1.html` and their manifest and icons) is
   removed. It was never deployed and gave different answers.
   `MONETIZE_HANDOFF.md` is headed SUPERSEDED.

Tests: 14 new ones.
- 10 loop tests: every plan closes, never over-uses a piece, never mixes
  brands or radii, respects the table size, random boxes.
- 1 test that the gap finder never uses more of a piece than you own.
- 3 curved-gap tests.

All suites pass: library validate, typecheck, solver 38, web 87, others
unchanged.

## What I saw on the phone shots (headless Chrome, 412 x 915)

Before (in `/tmp/trackfit-shots/a*` and `b*`, gone when the box stops):
- The first screen was 16 brand buttons, each stamped DRAFT. Nothing
  showed what the app does.
- Inventory rows were four lines each, with names cut off ("9" straight
  (nickel silve").
- "+ photo" text spilled out of its box.
- "What can I build" sat at the very bottom of the page.
- The footer said "prototype".

After:
- The first screen says what the app is for, then Step 1 / 2 / 3.
- The loop cards draw cleanly; the curves bulge outward. My first build
  bent every curve inward; the shots caught it and it is fixed.
- The printed plan (print media emulated) shows only that plan, plus the
  app's name.
- The offline cold start shows the full app.
- Bigger text visibly grows the page.

**What I did not verify:**
- A real phone (Pixel or iPhone), iOS Safari, or a real printer. Print was
  only emulated.
- That the "Print inventory report" PDF opens. Its unit tests pass.
- CI on Node 20. I ran Node 24 here.
- Loop search speed on a phone. In Node, the worst box I tried (12
  straight types and 6 curve types, 30 of each) took 0.9 s, and 16 real
  catalogues took 5 to 735 ms. A phone is slower. The button shows
  "Working…".
- The catalogue numbers. The library still marks every system
  `unverified-draft`: sizes are worked out from the makers' stated
  dimensions, but part numbers were never checked online. The app now says
  "check one piece with a ruler if a fit really matters".

## Bugs left (written down, not fixed)

- **Atlas O True-Track:** its four curves have no sweep angle in the
  library, so they are dropped and no loop can be planned.
- **Flex track:** Peco Streamline is flex-only, so it gets the "needs
  sectional curves" message.
- **Loop shapes:** the exact planner does circles and ovals only. No
  sidings, figure eights or double ovals. The rough guide still works from
  totals.
- **Big boxes:** above 24 straight pieces the oval search switches to a
  fast method that can miss the very longest oval in rare mixes. Every
  answer still closes.
- **"I own" filter:** a row disappears the moment its count reaches 0 while
  you are editing it.
- **Mixed rail:** the gap filler mixes nickel silver and steel rail in one
  run. Bachmann's own notes say not to mix them electrically.
- **Undo toast:** it covers the bottom of the screen for about 5 seconds.
- **`deploy.yml` (needs the workflow scope, which this box's login lacks):**
  it still passes the dead `VITE_PREMIUM_*` and photo-ID secrets. No code
  reads them now, so this is harmless but untidy. The ready patch is in
  `docs/handoff/deploy-yml-cleanup.patch`. Delete those repo secrets too.
- **Stale docs:** `docs/launch/*` (forum posts, sell sheet, founder story),
  `README.md` and `docs/tester-card.md` still sell the Founder licence
  and/or name the old domain.

## His calls

1. **Free or paid.** The branch is free. Things a paid tier could honestly
   sell later:
   - a one-time price on the store for the whole app;
   - checked catalogue data (real pieces measured);
   - more layout shapes (ovals with a siding, figure eights);
   - full-size printable templates.

   Photo ID must not come back until it is real.
2. **What paid customers are owed.** 25 Founder licences were issued in May.
   Now that everything is free, do those buyers get a note?
3. **The Cloudflare worker.** Check dash.cloudflare.com for a worker named
   `trackfit-vision` holding an Anthropic key. If it was ever deployed it
   can still be billed.
4. **Name.** The listing title is drafted as "Trackfit: Model Track Planner".
5. **Support email.** I used stephen@skywolfstudio.com, taken from the
   studio's other apps.
6. **Domain.** Moving to `trackfit.skywolfstudio.com` is recommended, and
   should happen before any store build. Steps below.
7. **Store.** Play first, then Apple, or both? Apple usually rejects a
   website in a wrapper (guideline 4.2), and building for Apple needs a Mac.

## Domain move (his steps; not done here)

GitHub Pages serves this repo; `apps/web/public/CNAME` names the domain.

1. At the DNS host for skywolfstudio.com, add a record:
   `CNAME  trackfit  stephenuffugus.github.io`.
2. On the branch (or main), change `apps/web/public/CNAME` to
   `trackfit.skywolfstudio.com`. Merge it; the workflow deploys.
3. Go to GitHub, then trackfit, then Settings, then Pages. Set the custom
   domain to `trackfit.skywolfstudio.com`, wait for the certificate, and
   tick Enforce HTTPS.
4. Know before you move: Pages serves one custom domain, so
   `trackfit.stevieweedseed.com` will stop answering. A saved track list
   lives in the browser storage of the old address, and installed copies
   are tied to it. Anyone with a list should use "Export my inventory"
   (gear menu) first, then "Import" on the new address. If you can keep the
   old domain, point it at a one-page redirect instead.
5. Then the Play wrapper: `store/PLAY-READINESS.md`.

## The single command that ships it (for HIM to run)

This moves `main` forward to this branch (a fast-forward, nothing is
force-pushed). The Pages workflow then publishes it to the current
domain:

```
env -u GITHUB_TOKEN gh api -X PATCH repos/Stephenuffugus/trackfit/git/refs/heads/main -f sha="$(env -u GITHUB_TOKEN gh api repos/Stephenuffugus/trackfit/git/refs/heads/perfect-nov14 -q .object.sha)" -F force=false
```
