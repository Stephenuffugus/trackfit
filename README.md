# Trackfit

**The field guide for sectional track.** Photograph what's in your box,
photograph the gap, and get every combination of straights, curves, and
turnouts that bridges it — exact or close — in seconds. When nothing fits
exactly, Trackfit tells you the one piece you'd need ("you'd need a 2.5″
straight to close this"). No CAD, no learning curve, no desktop required.

Built for the workbench, not the office. Mobile-first, installable PWA.

**Live:** https://trackfit.stevieweedseed.com/

---

## What it does

- **Gap solver** — subset-sum + curve-aware solver with a near-miss
  ("missing piece") suggestion when there's no exact fit.
- **Reference-object measurement** — lay a quarter, a dollar bill, or a
  piece you own in the gap and photograph it to get the length.
- **"What can I build?"** — scores 20+ layout templates against the track
  you actually own and shows what's buildable today vs. one trip away.
- **Track library** — 16 sectional systems across N/HO/OO/O and more, each
  piece carrying a source citation and a verification date.
- **1:1 cut templates & inventory export** — printable PDF cut guides and
  JSON backup, free.
- **Photo-ID (rolling out)** — Claude Vision auto-fill behind a Cloudflare
  Worker proxy; activation-gated.

The gap solver, the full library, manual inventory, the layout suggester,
measurement, cut templates, and JSON export are **free**. A one-time
**Founder** unlock adds the printable inventory binder, the full vendor
list, and photo-ID auto-fill as it rolls out. No subscription.

## Stack

pnpm monorepo — one Vite + React 18 + TypeScript + Tailwind PWA app over
seven independently testable packages (`solver`, `library`, `measure`,
`cut-templates`, `layouts`, `marketplace`, `plan-import`). Vitest. CI/CD
via GitHub Actions → GitHub Pages.

## Develop

```bash
pnpm install
pnpm dev        # run the web app
pnpm verify     # validate library + typecheck + test + build (CI gate)
```

## Status

Active, pre-1.0. The track library is a verified-geometry draft; SKU and
source-URL fields are being re-verified before any public accuracy claim
is made. See `docs/changelog.md` for the forensic per-release record and
`MONETIZE_HANDOFF.md` for product/commercial context.

## License

UNLICENSED — proprietary. © Stephen. All rights reserved. Not for
redistribution.
