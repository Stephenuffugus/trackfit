# Trackfit: store listing draft (Play first)

Draft only. Nothing here is uploaded. Every line below can be checked
against the app on the `perfect-nov14` branch.

## App name (30 characters max)

    Trackfit: Model Track Planner

(29 characters. Alternatives: "Trackfit: Train Track Loops", "Trackfit".)

## Short description (80 characters max)

    See the loops you can build from the model train track you already own.

(72 characters.)

## Full description

    Got a box of sectional track and not sure what it will make?

    Tell Trackfit which track you have and how many of each piece. It shows
    the complete loops you can build today from your own box: circles,
    ovals, rounded rectangles, and figure eights if you own a crossing.
    Each one is drawn piece by piece, with the table space it needs, the
    pieces to take out, the order to lay them, and what is left in the box
    afterwards. The answer that uses the most of your track comes first,
    and it can suggest a second loop from what is left over. Give it the
    size of your table and it only shows loops that fit.

    Every loop it shows really closes: one brand, one rail material, one
    curve size, and never more of a piece than you own.

    Short of a loop? It tells you how far short you are ("you are 30
    degrees short of a full circle").

    Filling an awkward gap instead? Type the gap's length and Trackfit
    finds the combinations of your pieces that fill it exactly, or the
    nearest under and over, and the size of piece that would close the
    rest. Curved gaps and S-bends too.

    Track systems built in (16):
    Atlas HO Code 100 and Code 83, Atlas N Code 80, Atlas O, Bachmann E-Z
    Track HO and N, Hornby OO, Kato Unitrack HO and N, Lionel FasTrack,
    Lionel O27 Tubular, Märklin C-Track and K-Track, Peco Setrack Code 100,
    Peco Streamline Code 100 and Code 83. You can also add any piece by
    hand.

    Made for the train room:
    • Large type, large buttons, a Bigger text setting.
    • Works with no signal once installed.
    • Print a plan or a list of everything you own, or save a backup file.

    Your track list stays on your device. No account, no sign in, no ads,
    no tracking.

    Piece sizes come from the makers' published catalogues. If a fit really
    matters, measure one piece first.

    Trackfit is a Sky Wolf Studio tool.

(about 1,900 characters; limit 4,000.)

## What to leave out (and why)

- Do not claim layouts with turnouts, sidings, dogbones or kidneys. The
  exact planner does circles, ovals, rounded rectangles and figure eights
  (through a crossing whose angle and length are in the catalogue); the
  "More layout ideas" guide is a rough guide from totals.
- Do not say the catalogue data is verified. It is marked
  `unverified-draft` in the library (sizes are worked out from the makers'
  stated inches and millimetres; part numbers were not checked online).
- No "hand painted", "hand drawn", "hand built". No mention of AI.

## Category, rating, contact

- Category: Tools (alternative: Lifestyle).
- Content rating questionnaire: no violence, no user content, no sharing
  between users, no purchases. Expected: Everyone / PEGI 3.
- Target audience: adults (18+). Not designed for children.
- Contact email: stephen@skywolfstudio.com (HIS CALL, see HANDOFF.md).
- Privacy policy URL: `https://<final domain>/privacy.html` (page ships
  with the app at `apps/web/public/privacy.html`).

## Data safety form (answers the code supports)

- Does the app collect or share any of the required user data types? **No.**
  The app makes no network requests of its own: `grep -rn "fetch("
  apps/web/src packages/*/src` returns nothing, there is no analytics, no
  crash reporting, no account. The track list and any photos live in the
  browser storage on the device.
- Photos: taken with the camera only when the user taps "+ photo", kept on
  the device, never uploaded, never analysed. They are not "collected" in
  Play's sense because they never leave the device.
- Is data encrypted in transit? Not applicable (nothing is sent).
- Can users ask for data to be deleted? Yes: Reset in the app, or clear
  the app's storage, or uninstall.
- External links: "Where to buy" opens shop search pages (eBay, Walthers,
  Amazon and others) in the browser. No affiliate tags. "Report an issue"
  opens the user's email app.

## Graphics in this folder

| File | Size | Made from |
|---|---|---|
| `screenshots/01-loops-you-can-build.png` | 1082 x 1922 | the real app, Kato Unitrack N box, the loop that uses the most of it |
| `screenshots/02-your-track.png` | 1082 x 1922 | brand picker with Kato Unitrack N chosen |
| `screenshots/03-counts.png` | 1082 x 1922 | "I own" filter, counts entered |
| `screenshots/04-fits-your-table.png` | 1082 x 1922 | table size 1300 x 800 mm, the loop that fits |
| `screenshots/05-fill-a-gap.png` | 1082 x 1922 | a 434 mm gap, two exact fits |
| `screenshots/06-figure-eight.png` | 1082 x 1922 | Peco Setrack box with a 90° crossing, the figure eight |
| `feature-graphic-1024x500.png` | 1024 x 500 | the app's own loop drawing (SVG copied from the page) and its fonts |
| `icon-512.png` | 512 x 512 | `apps/web/public/icon.svg`, an oval drawn the way the app draws loops |

Screenshots were taken in headless Chrome at 412 x 732 CSS pixels, scale
2.625, from a local build of the branch. They are plain captures, no
captions added.
