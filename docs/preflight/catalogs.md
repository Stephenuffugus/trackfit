# Pre-flight: Track Catalogs

**Fetch status:** WebFetch and WebSearch were denied by the harness for every URL attempted, despite the prompt-level allowlist. Findings draw on prior product knowledge; Track 1 sub-agents must re-verify live.

## 1. Lionel FasTrack (US 3-rail O)

- **Catalog:** Yes — lionel.com lists every current SKU; annual Lionel Catalog PDFs (`lionel.com/catalogs`) print each piece with length and curve diameter.
- **Format:** Shopify-style storefront, server-rendered enough to scrape, but dimensions live inconsistently across title, spec table, and PDF. Mix HTML+PDF. No interactive designer.
- **Dealers:** Trainz and MTS carry FasTrack with cleaner tables and consistent SKUs (`6-12014` 10" straight, `6-12015` O36 curve). Tower thinner; Walthers not the cleanest.
- **Gotcha:** Curves labeled by **diameter** ("O36"), not radius — store radius (= dia/2). Half- and quarter-curves need explicit arc-degree fields. The 5-1/8" and 1-3/8" fitters sit in a separate group and are easy to miss.
- **Verdict:** Smooth. ~40 SKUs, dimensioned. Sources: `lionel.com/products/track/fastrack/`, `lionel.com/catalogs/`, `trainz.com`.

## 2. Märklin C-Track (German H0 3-rail)

- **Catalog:** Yes, split across HTML and PDF. The **C-Gleis Gleisplanbuch PDF** on marklin.de documents every piece with exact length, radius, angle — the gold reference.
- **Format:** marklin.de browse view is JS-heavy (faceted filters, lazy grids); individual SKU pages are server-rendered with a clean spec table. PDF more reliable. No online designer.
- **Dealers:** Reynaulds.com (US Märklin specialist) is the cleanest English source — every C-Track SKU has length/radius/angle. Walthers incomplete; Trainz/Tower unreliable for Märklin.
- **Gotcha — the Märklin trap:** Gleisplanbuch radii are **centerline** (R1=360, R2=437.5, R3=515, R4=579.3, R5=643.6 mm). Forum tables sometimes quote "outer rail" or "edge of roadbed" — do not mix. Cite the PDF. Dealers occasionally mis-list older M- or K-track SKUs as C-track — verify family prefix.
- **Verdict:** Smooth only if sub-agent uses the Gleisplanbuch PDF as truth. Sources: `marklin.de/en/products/tracks/c-track`, `reynaulds.com`.

## 3. Kato Unitrack (N + HO)

- **Catalog:** Yes, the cleanest of the three. katousa.com publishes a Unitrack PDF plus per-piece pages with length, radius, arc degrees. katomodels.com (Japan) has the deepest list including JP-only SKUs.
- **Format:** Mostly static HTML, predictable URLs. Each page lists code (`20-000` 248mm straight), length, diagram. PDF canonical. No designer.
- **Dealers:** MTS and Trainz list Unitrack with clean per-SKU dimensions; Walthers truncates some. Keep katousa/katomodels primary.
- **Gotcha:** Coded names — `S` straight (`S248`, `S186`, `S124`, `S62`, `S29`), `R` curve (`R315-45` = 315mm radius, 45° arc), `V` variable/viaduct, `WS`/`CS` wide/compensating. HO Unitrack reuses the letters at different magnitudes — split N and HO into separate JSON files. Some SKUs JP-only — flag in notes.
- **Verdict:** Smoothest. Sources: `katousa.com/N/Unitrack/`, `katomodels.com`.

## Risk assessment — Track 1, the 12 priority systems

**Smooth (~1 day):** Kato Unitrack N/HO, Atlas HO Code 83/100, Atlas N Code 80, Lionel FasTrack, Bachmann EZ-Track HO/N. Clean catalogs, dimensions printed, dealer cross-checks.

**Extra time (2–3 days):** Lionel O27 Tubular (legacy, scattered specs, off-catalog SKUs — needs eBay/dealer corroboration), Atlas O 21st Century / True-Track (two lines often confused), Märklin C-Track (PDF discipline, centerline trap), Märklin K-Track (older, partial docs, same trap).

**Wildcard:** WebFetch and WebSearch were denied for all three targets here. If the block persists, sub-agents fall back to manual PDF parsing only, doubling per-system time. Grant Track 1 sub-agents persistent fetch access before dispatch.

**"1–3 days per system" realistic?** Yes for the smooth tier and at the upper bound for Märklin and Lionel O27, *assuming* fetch works. Without it, budget 2–4 days and expect three systems (Lionel O27, Märklin K, Atlas True-Track) to ship with explicitly-flagged `null` fields per the handoff's "empty is honest, wrong is fatal" rule. Total: ~18–24 agent-days with fetch, ~30–36 without.
