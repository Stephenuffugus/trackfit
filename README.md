# Trackfit

**The field guide for sectional track.** Type in what's in your box, tell it
the gap you're trying to close, and get every combination of straights,
curves, and turnouts that bridges it — exact or close — in seconds. When
nothing fits exactly, Trackfit tells you the one piece you'd need ("you'd
need a 2.5″ straight to close this"). No CAD, no learning curve, no desktop
required.

Built for the workbench, not the office. Mobile-first, installable PWA.

**Live:** see HANDOFF.md (the app is moving to a Sky Wolf Studio address). Trackfit is a Sky Wolf Studio tool.

---

## What it does

- **Gap solver** — subset-sum + curve-aware solver with a near-miss
  ("missing piece") suggestion when there's no exact fit.
- **Reference-object measurement** — lay a quarter, a dollar bill, or a
  piece you own in the gap and photograph it to get the length.
- **"What can I build?"** — finds complete loops you can build today from
  only the pieces you own (circles, ovals, rounded rectangles, figure eights
  through a crossing), each one checked to close, drawn, with table space,
  parts list, laying order, what is left over, and a second loop from the
  leftovers. Ranked by how much of your track it uses. A rougher guide also
  scores 20+ layout ideas from your totals.
- **Track library** — 16 sectional systems across N/HO/OO/O and more, each
  piece carrying a source citation and a verification date.
- **1:1 cut templates** — printable PDF cut guides for flex track.
- **Inventory binder** — printable PDF of every piece you own, for
  insurance or estate documentation.
- **Row photos** — snap a picture of a piece so you can tell two similar
  rows apart. Purely a memory aid; nothing is uploaded or analysed.
- **JSON export / import** — a backup file you own and can email yourself.

Every one of those is free, for everyone, with no account. There is no paid
tier, no subscription, no ads, no tracking, and no server: the whole app
runs offline in your browser and your inventory never leaves your device.

Vendor links (eBay, Walthers, Hattons, and so on) appear next to a missing
piece to help you go find one. They are plain public search URLs with no
referral or affiliate parameter attached, and no vendor can pay to move up
the list.

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
is made. See `docs/changelog.md` for the forensic per-release record.

## License

UNLICENSED — proprietary. © Stephen. All rights reserved. Not for
redistribution.
