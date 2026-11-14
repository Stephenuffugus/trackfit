# Trackfit: Play readiness (no listing, no upload)

## Ready on the branch

- Web app manifest: `id`, name, short name, description, start URL and
  scope `./`, standalone, portrait, theme and background colours, PNG
  icons 192 and 512, a maskable 512, an SVG icon.
- Service worker (vite-plugin-pwa, Workbox): precaches all 21 files
  including fonts, icons and the privacy page. Checked in headless Chrome:
  load once, close the tab, turn the network off, open the app again: it
  opens, and the privacy page opens too.
- No analytics, no ads, no sign in, no network requests of its own.
- Privacy page: `apps/web/public/privacy.html`, served at `/privacy.html`.
- No payments anywhere (the old $19 Founder licence and Payhip links are
  removed), so nothing in the app touches Play's payments rules.

## Not done (needs his decisions or a deploy)

1. **Domain.** The app is served at `trackfit.stevieweedseed.com` (the old
   parent company's name). A Trusted Web Activity shows its origin when
   verification fails, and the installed app is tied to that origin. Move
   the domain first (steps in HANDOFF.md), then build the Android wrapper
   against the new origin.
2. **Android wrapper (TWA).** With the new domain live:
   `npx @bubblewrap/cli init --manifest https://<domain>/manifest.webmanifest`
   then `bubblewrap build`. Package name suggestion:
   `com.skywolfstudio.trackfit`. Keep the signing key in the private vault.
3. **Digital Asset Links.** Put the SHA-256 of the Play app signing key in
   `apps/web/public/.well-known/assetlinks.json` and deploy, then check
   `https://<domain>/.well-known/assetlinks.json` answers 200. (Not created
   here: it needs the real key fingerprint, and a wrong file is worse than
   none.)
4. **Store listing.** Copy and graphics drafted in `LISTING.md` and this
   folder.
5. **Apple.** The App Store usually rejects apps that are a website in a
   wrapper (guideline 4.2, minimum functionality). Trackfit works fully
   offline and prints, which helps, but it would need a native shell
   (Capacitor) and a Mac to build. Play first is the cheaper test.
