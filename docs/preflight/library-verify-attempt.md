# Library Verification Pre-flight Report

**Date:** 2026-05-05
**Agent:** library-verify pass
**Outcome:** ABORTED before any JSON modifications. Tools-test failed.

## What I tried

Per the brief, I ran a tools-test sequence before touching any of the 16
`packages/library/data/*.json` files. The brief was explicit: if WebFetch is
denied, write this report and stop — do not fabricate data, do not stamp
`source_verified_at` without a real fetch.

### 1. Lionel.com smoke test

```
WebFetch https://www.lionel.com
  -> 403
WebFetch https://www.lionel.com/products/fastrack-10-straight-track-6-12014/
  -> 403
WebFetch https://www.lionel.com/products/fastrack-o36-curve-track-6-12015/
  -> 403
```

All three returned HTTP 403. This is a server-side block (Lionel's CDN /
bot-detection rejecting the harness user-agent), not a harness denial. The tool
itself executed; the origin refused. Per the brief, this counts as
"tool worked but server rejected" — so I proceeded to other allowlisted
domains.

### 2. Other allowlisted domains — harness-level denial

```
WebFetch https://www.katousa.com/HO/unitrack.html
  -> "Permission to use WebFetch has been denied"
WebFetch https://www.atlasrr.com/code83main.htm
  -> "Permission to use WebFetch has been denied"
WebFetch https://katomodels.com/product/n/unitrack
  -> "Permission to use WebFetch has been denied"
```

These three URLs are all on domains explicitly listed in the brief's
allowlist (`katousa.com`, `www.katousa.com`, `katomodels.com`,
`atlasrr.com`, `www.atlasrr.com`). Despite that, the harness returned a
permission-denied error rather than fetching. This is the exact failure mode
the brief warned about for prior agents.

## Why I stopped

The brief is unambiguous:

> If you get "Permission to use WebFetch has been denied" — STOP. Write a
> brief report ... Do NOT modify any JSON files. Do NOT fabricate data.

Two of three priority-1 systems (Kato Unitrack N via katousa.com /
katomodels.com, Atlas HO Code 83 via atlasrr.com) are unreachable. Lionel is
reachable by the tool but blocked by the origin server, so I cannot confirm
SKUs or dimensions there either. With those three blocked, there is no way
to verify the most important systems and no responsible way to flag
`data_quality: "verified"` on anything.

I did not invoke WebSearch as a fallback because:

1. Search snippets are not the same as fetching the manufacturer page; the
   brief requires an actual fetch of the per-piece `source_url`.
2. Stamping `source_verified_at` based on a search-result blurb would
   reproduce exactly the failure mode the brief calls out ("the previous
   library agents made that mistake — don't repeat it").

## Files touched

None. All 16 JSON files under `packages/library/data/` are unchanged.
`data_quality` remains `"unverified-draft"` and every `source_verified_at`
remains `null`, which is honest given what I could actually verify.

## Recommended next steps (for the user / next agent)

1. **Diagnose the harness allowlist.** The brief lists `katousa.com`,
   `atlasrr.com`, and `katomodels.com` as allowed, but the harness denied
   all three. Either the harness `permissions.allow` config in
   `.claude/settings.json` does not actually contain `WebFetch(domain:...)`
   entries for these domains, or the config uses a pattern that does not
   match the URLs I tried. Worth running `/permissions` or inspecting
   `.claude/settings.json` and confirming entries like:
   `WebFetch(domain:atlasrr.com)`, `WebFetch(domain:www.atlasrr.com)`, etc.
2. **For Lionel specifically,** the 403 is a CDN bot-block. Even with
   allowlisting, the Lionel origin will likely keep refusing the WebFetch
   user-agent. Two workarounds:
   - Fall back to a dealer page (legacystation.com, charlesro.com,
     trainz.com) that mirrors the Lionel SKU and dimensions.
   - Use cached / archive.org snapshots of lionel.com product pages.
3. **Priority order on retry** (unchanged from the brief): Lionel
   FasTrack -> Kato Unitrack N -> Atlas HO Code 83 -> Marklin C-Track
   -> Peco Setrack -> Bachmann EZ-Track HO.
4. **Marklin and Hornby risk.** marklin.de and hornby.com are likely to
   be JS-rendered SPAs; even with WebFetch working, the markdown
   conversion may produce empty bodies. Plan a dealer-page fallback
   (reynaulds.com / modellbahnshop-lippe.de for Marklin;
   hattons.co.uk / railsofsheffield.com / gaugemaster.com for Hornby)
   before starting that work.

## Tools-test summary (for the brief's deliverable section)

- Tools-test result: **partial denial** — WebFetch executed against
  lionel.com (origin returned 403); WebFetch was harness-denied for
  katousa.com, atlasrr.com, katomodels.com despite those domains being
  in the brief's stated allowlist.
- Per-system: 0 verified / N pieces across all 16 systems. Nothing
  modified.
- Dimensions corrected: none.
- Systems left fully-unverified: all 16, due to inability to fetch.
- Next-pass priority: fix the allowlist mismatch first, then start
  with dealer-page fallbacks for Lionel since the origin 403s
  appear to be persistent.
