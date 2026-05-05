# Plan import — provenance and assumptions

This package (`@trackfit/plan-import`) parses **AnyRail** XML plan exports
and produces a buy list against the user's inventory. It is the foundation
for the strategy-doc §5 Phase 2 feature: *"Plan import. Drop in an AnyRail /
SCARM / XTrkCAD / JMRI file, get a buy list against your inventory."*

This document records what is **observed** vs **assumed** about the AnyRail
XML format, so a future maintainer can tell at a glance which parts of the
parser are solid and which are best-effort guesses awaiting real samples.

## Status: best-effort, no real samples on hand

We did **not** live-fetch AnyRail samples while building this package — the
manufacturer/vendor CDNs that host them are bot-blocked from the Codespace
environment per project memory (`reference_codespace_blocked_domains.md`).
Everything here is reasoned from publicly-available specs, forum posts, and
the AnyRail website's documentation pages.

When real `.any`-exported XML lands in our hands (almost certainly via a
beta-tester drop), we should diff our hand-rolled fixtures against it and
update both this doc and the parser. Add a row to the "Confirmed against
real export?" column below for every section.

## Assumed XML shape

We assume AnyRail emits XML approximately like this:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<anyrail-plan version="6.x" name="My Layout">
  <library-set>
    <library id="atlas-ho-code-83" />
  </library-set>
  <pieces>
    <piece library-id="atlas-ho-code-83" piece-code="521" />
    <piece library-id="atlas-ho-code-83" piece-code="521" />
  </pieces>
</anyrail-plan>
```

| Element / attribute             | Source             | Confirmed against real export? |
| ------------------------------- | ------------------ | ------------------------------ |
| `<anyrail-plan>` root           | forum posts        | no                             |
| `name` attribute on root        | reasoned from UI   | no                             |
| `<library-set>` block           | reasoned           | no — parser ignores it anyway  |
| `<piece library-id piece-code>` | forum posts, docs  | no                             |
| Self-closing `<piece />`        | XML convention     | no                             |
| Repeated piece elements per use | reasoned (simplest | no — could be `count="N"`      |
|                                 | export format)     | instead; parser sums either    |
|                                 |                    | way once we add `count`        |

Things that real exports might add and that we currently **silently skip**:

* XML namespaces (`xmlns:anyrail="..."`, prefixed elements)
* Geometry — pieces probably also carry `x`, `y`, `rotation`, `connections`
* Piece attributes we don't recognise (length, radius — irrelevant for buy lists)
* Wrapping `<plan>` or `<document>` elements

The parser is intentionally tolerant of these — they should land in zero
warnings.

## Library-id mapping

AnyRail's library ids appear to align with our `@trackfit/library` slugs
(e.g. `atlas-ho-code-83`). The mapping is explicit in
`src/anyrail.ts → ANYRAIL_TO_TRACKFIT_SYSTEM`. **If a real AnyRail export
uses a different id**, add an alias entry there — don't rename our slugs.

Unknown library ids are tagged `system_id: "unknown"` in the requirement
output and surface as a warning. The buy-list builder treats them like any
other system, except no library cross-reference happens (so the `label`
falls back to the raw `product_code`).

## Parser strategy: regex, not DOM

We hand-rolled a regex parser instead of pulling in `@xmldom/xmldom`.
Justification:

* The shape we extract is shallow — attributes on a single repeated leaf
  element. No nested element bodies. No mixed content.
* Adding a DOM-XML dep doubles the package's wire weight for negligible
  gain at this fidelity.
* `parsePlan` returns warnings rather than throwing, so the regex parser's
  weaker error handling is fine.

If real-world AnyRail XML turns out richer than we assume — namespaces with
prefixes, CDATA blocks holding piece data, conditional XML comments — swap
`anyrail.ts` for a proper `@xmldom/xmldom` parser without changing the
`parsePlan` / `ParsePlanResult` public surface.

## Defensive posture

Per strategy doc §3.5 ("wrong is fatal; empty is honest"):

* Malformed XML → empty `requirements`, single `XML parse failed: ...`
  warning. No throw.
* Unknown `library-id` → kept as a requirement, system tagged `"unknown"`,
  one warning listing all unknown library ids.
* `<piece>` missing `library-id` or `piece-code` → silently dropped, single
  aggregate warning ("Ignored N pieces with missing ...").
* Foreign elements inside `<pieces>` → silently ignored.

## Future formats

`ParsePlanResult.format` is currently `"anyrail"` only. SCARM, XTrkCAD, and
JMRI are on the roadmap — when we add them, `parsePlan` should sniff the
input and dispatch, and the type should widen to a union.
