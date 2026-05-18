# What's new — v0.3.5 (2026-05-18)

The launch-prep build. This is the version cut to put in front of the
public on the forums. Full forensic detail in `docs/changelog.md`;
product/commercial context in `MONETIZE_HANDOFF.md`; the go-live steps
you have to do yourself in `GO-LIVE-RUNBOOK.md`.

---

## You will see this in "What can I build?"

### Buildable vs. close, split into two clear groups
The layout suggester no longer shows one long list. Now there's a
**"✓ You can build these now (N)"** group at the top and a separate
**"You're close to these (N)"** group below it, each with a plain
heading. The engine's ranking didn't change — this just makes the
"I can build three things *today*" moment impossible to scroll past.

### O-gauge layouts that fit O-gauge space
Three new templates sized for O gauge — **O-gauge starter oval**,
**O-gauge loop with siding**, and **Christmas tree loop (O)** — with
real O footprints instead of HO-sized sketches. If you run Lionel-world
O gauge and pick the "O" scale chip, the suggestions now speak your
space. (The universal templates still show too.)

### Honest message when a hard gap runs out of time
If you throw a very large inventory at a tricky gap and the solver hits
its time budget before finding *anything*, you now get an honest
"it ran out of time — not 'nothing fits'; try a shorter segment"
message instead of a misleading "nothing comes close."

---

## You will see this if you tap "Trackfit Premium"

The model is decided: a **one-time $19 Founder unlock — no
subscription**. The modal copy is now Founder-framed and honest — it
states the printable inventory binder and full vendor list are live,
photo-ID auto-fill "rolls out to Founders," and it no longer mentions
cloud sync (not built) or paid cut templates (those are free).

Until you set `VITE_PREMIUM_LIFETIME_URL`, it stays in the honest
"we're still figuring out a fair price" fake-door state — safe to ship
publicly as-is, collects signal, costs nothing.

---

## Photo-ID

Still the **free stub** — deliberately. No paid Vision spend until
Founder revenue funds it. Founders still get the 3-trial taste so the
feature feels real. The copy never oversells this.

---

## Packaging

- Version off the perpetual `0.3.0-dev` → **`0.3.5`**.
- Real project `README.md` (was a one-line stub).
- Launch kit added under `docs/launch/`: tailored forum posts (OGR /
  Model Train Forum / MRH / Trains.com), the founder story, the
  demo-video script, the sell sheet, and the 30/60/90 plan.
- `GO-LIVE-RUNBOOK.md` at the repo root — the exact, only-you steps:
  make the Payhip product, set three GitHub secrets, push, issue codes.

---

## Still explicitly your call (per handoff §9)

- Creating the Payhip product and setting the payment env (go-live).
- Posting the forum drafts (your account, your voice — no Reddit).
- Turning on real Vision photo-ID (only after Founder revenue).
- Any analytics/tracking (recommended: none — the model is honest by
  design).
- Library accuracy claims (hold until the SKU/source re-verify pass).
