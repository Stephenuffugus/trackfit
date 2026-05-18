# Trackfit — Go-Live Runbook (Stephen only)

These are the steps **only you** can do — they need your money, your
accounts, and your signoff. Everything else (the code, the engine fixes,
the launch copy) is done and on `main`. Verified accurate against the
repo on 2026-05-18.

The model, decided: **one-time $19 Founder license, no subscription.**
Photo-ID stays on the free stub (no paid API spend) until Founder
revenue exists to fund it.

---

## A. The 5-minute version (first sale today)

1. Create a **Payhip** product: one-time, $19, name "Trackfit Founder".
   Copy its product URL.
2. In GitHub → repo **Settings → Secrets and variables → Actions →
   Secrets** → add three repository secrets:
   - `VITE_PREMIUM_ENABLED` = `true`
   - `VITE_PREMIUM_LIFETIME_PRICE` = `$19`
   - `VITE_PREMIUM_LIFETIME_URL` = *(the Payhip URL)*
3. Trigger a deploy: Actions tab → "Deploy Trackfit web app" → **Run
   workflow** on `main` (or just push any commit to `main`).
4. Done — the upgrade modal now shows a real $19 buy button. Fulfillment
   (issuing codes) is section C.

Leave `VITE_PREMIUM_MONTHLY_*` unset (no monthly tier). Leave
`VITE_USE_REAL_PHOTO_ID` and `VITE_PHOTO_ID_PROXY_URL` **unset** — that
keeps photo-ID on the no-cost stub. Do not set them until section E.

---

## B. Pick the payment host (one-time, no Stripe code needed)

Both need ~10 minutes and pay out to your bank. No Stripe SDK touches the
app — it's just an outbound link.

- **Payhip (recommended)** — supports *automatic delivery of a unique
  code per sale* from a pre-uploaded list. That's the genuinely
  hands-off path: see section D.
- **Gumroad** — also fine; "content/license key" delivery works
  similarly. Slightly higher fees.

Set the product to digital, **one-time** (not a membership), price `$19`,
title "Trackfit Founder", and a short description: *"A one-time unlock —
no subscription. You'll receive a license code to activate Trackfit
Premium. Founders keep this price if it rises."*

---

## C. Fulfillment — issuing a license code (manual)

When someone buys, they need a `TFP-XXXX-XXXX-XXXX` code.

1. Generate one:
   ```bash
   node scripts/gen-license-code.mjs
   ```
   It prints a **CODE** (email this to the buyer) and a **HASH** (goes in
   the app).
2. Open `apps/web/src/lib/premium.ts`, find `VALID_LICENSE_HASHES`, and
   **append** the printed hash as a new `"…",` line.
   - ⚠️ **Do NOT delete the three placeholder entries**
     (`"a".repeat(64)`, `"b".repeat(64)`, `"c".repeat(64)`). The premium
     test suite depends on `"a".repeat(64)` being present
     (`__TEST_ONLY.knownGoodHash`). Removing them turns the build red.
     Just add yours alongside them.
3. Commit and push to `main`. The deploy workflow redeploys
   automatically (~2–3 min).
4. Email the buyer their CODE. They open Trackfit → Settings → activate
   → paste it. Activation is offline after that and works on all their
   devices (deliberate — see the premium.ts header).

The codes exclude 0/O/1/I/L so you can read one over the phone if a buyer
emails confused.

---

## D. Hands-off fulfillment (do this once you've sold a couple)

Manual is fine at first; this makes it passive:

1. Generate a batch:
   ```bash
   node scripts/gen-license-code.mjs --count 25 --json
   ```
2. Append **all 25 hashes** to `VALID_LICENSE_HASHES` (keep the
   placeholders), commit, push, deploy.
3. In Payhip, enable automatic delivery and paste the **25 codes** (not
   hashes) as the unique-content/license list — one per buyer,
   auto-sent on purchase.
4. Now a sale delivers a working code with zero action from you. Refill
   the list when it runs low. That's the "subtle hands-off income" —
   the only recurring task is topping up codes occasionally.

---

## E. Photo-ID (do NOT do this at launch)

Real Claude Vision costs money per photo. Per your own budget gate, leave
it off until Founder revenue is funding it. When that day comes:
deploy `infra/cloudflare-worker/` per `docs/SETUP-PHOTO-ID.md`, then set
GitHub secrets `VITE_USE_REAL_PHOTO_ID=true` and
`VITE_PHOTO_ID_PROXY_URL=<worker url>` and redeploy. Until then the stub
gives Founders the 3-trial taste at no cost and the copy says photo-ID
"rolls out to Founders" — which stays honest.

---

## F. Do-not list (protect the integrity that *is* the moat)

- ❌ Don't post the forum drafts from anywhere but your own account, in
  your own voice. ❌ No Reddit.
- ❌ No invented testimonials, user counts, or sock-puppet replies.
- ❌ No library accuracy boast until the SKU/source re-verify pass lands.
- ❌ No analytics/tracking bolted on to chase conversions.
- ❌ Don't enable paid photo-ID before revenue (section E).
- ✅ Do reply to every forum response within a day and publicly close the
  loop when you fix something. That responsiveness converts this
  audience better than any feature.

---

## G. After go-live

Follow `docs/launch/distribution-30-60-90.md`. The day-30 gate is real:
if there's near-zero interest after two forums and the video, the honest
read is "not yet" — reassess, don't just push harder.
