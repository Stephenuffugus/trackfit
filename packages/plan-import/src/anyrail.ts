import type { ParsePlanResult, PlanRequirement } from "./types.js";

/**
 * AnyRail XML parser.
 *
 * Why hand-rolled regex instead of an XML dep:
 *   The shape we care about — `<piece library-id="..." piece-code="..." />`
 *   inside an `<anyrail-plan>` root with an optional `name="..."` — is
 *   shallow, well-formed-or-we-bail, and free of nested element bodies for
 *   the data we extract. Pulling in `@xmldom/xmldom` (or wiring up `DOMParser`
 *   conditionally for Node) would dwarf the actual logic. If real-world
 *   AnyRail XML ever turns out richer than we assume, swap this file for a
 *   real DOM parser without changing the public surface.
 *
 * Defensive posture (per strategy doc §3.5 "wrong is fatal; empty is honest"):
 *   - malformed XML → `{ requirements: [], warnings: ["XML parse failed: ..."] }`
 *   - unknown elements → silently skipped
 *   - missing required attribute on a `<piece>` → counted to a single warning
 *     ("ignored N pieces with missing library-id or piece-code")
 *   - never throws.
 *
 * AnyRail library-id → Trackfit system_id mapping:
 *   At time of writing, AnyRail's library ids appear to align with our slugs
 *   (e.g. "atlas-ho-code-83"). The alias map below covers the cases where
 *   they don't. When we get real fixtures from users, fill this out.
 */

const ANYRAIL_TO_TRACKFIT_SYSTEM: Record<string, string> = {
  // Direct matches today, but listed explicitly so a future AnyRail rename
  // doesn't silently desync from our library ids.
  "atlas-ho-code-83": "atlas-ho-code-83",
  "atlas-ho-code-100": "atlas-ho-code-100",
  "atlas-n-code-80": "atlas-n-code-80",
  "atlas-o-true-track": "atlas-o-true-track",
  "bachmann-ez-track-ho": "bachmann-ez-track-ho",
  "bachmann-ez-track-n": "bachmann-ez-track-n",
  "hornby-oo": "hornby-oo",
  "kato-unitrack-ho": "kato-unitrack-ho",
  "kato-unitrack-n": "kato-unitrack-n",
  "lionel-fastrack": "lionel-fastrack",
  "lionel-o27-tubular": "lionel-o27-tubular",
  "marklin-c-track": "marklin-c-track",
  "marklin-k-track": "marklin-k-track",
  "peco-setrack-code-100": "peco-setrack-code-100",
  "peco-streamline-code-100": "peco-streamline-code-100",
  "peco-streamline-code-83": "peco-streamline-code-83",
};

const PLAN_NAME_RE = /<anyrail-plan\b[^>]*\bname\s*=\s*("([^"]*)"|'([^']*)')/i;
const PLAN_ROOT_RE = /<anyrail-plan\b/i;
const PIECE_RE = /<piece\b([^>]*?)\/?>/gi;
const ATTR_RE = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

export function parseAnyrail(xmlString: string): ParsePlanResult {
  const result: ParsePlanResult = {
    name: null,
    format: "anyrail",
    requirements: [],
    warnings: [],
  };

  if (typeof xmlString !== "string" || xmlString.trim() === "") {
    result.warnings.push("XML parse failed: input is empty");
    return result;
  }

  // Cheap structural sniff. We don't try to validate the whole document —
  // anything that looks like a malformed prolog or a missing root element
  // shows up as a parse failure.
  if (!PLAN_ROOT_RE.test(xmlString)) {
    result.warnings.push(
      "XML parse failed: no <anyrail-plan> root element found",
    );
    return result;
  }

  // Quick well-formedness check: tag-open count vs close count of `<` and `>`.
  // Crude, but catches "<piece library-id=oops" mid-document.
  const opens = (xmlString.match(/</g) ?? []).length;
  const closes = (xmlString.match(/>/g) ?? []).length;
  if (opens !== closes) {
    result.warnings.push(
      `XML parse failed: unbalanced angle brackets (${opens} '<' vs ${closes} '>')`,
    );
    return result;
  }

  const nameMatch = PLAN_NAME_RE.exec(xmlString);
  if (nameMatch) {
    result.name = decodeXmlEntities(nameMatch[2] ?? nameMatch[3] ?? "") || null;
  }

  // Group pieces by (system_id, product_code). Map keys are tab-joined to
  // avoid the unlikely-but-possible collision from a code containing a colon.
  const byKey = new Map<string, PlanRequirement>();
  let droppedPieces = 0;
  let unknownLibraryWarned = false;
  const unknownLibraries = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = PIECE_RE.exec(xmlString)) !== null) {
    const attrs = parseAttrs(match[1] ?? "");
    // AnyRail uses kebab-case attributes; tolerate camelCase variants if they
    // ever show up in older exports.
    const libraryId =
      attrs["library-id"] ?? attrs["libraryId"] ?? attrs["library"];
    const pieceCode =
      attrs["piece-code"] ?? attrs["pieceCode"] ?? attrs["code"];

    if (!libraryId || !pieceCode) {
      droppedPieces += 1;
      continue;
    }

    const systemId = ANYRAIL_TO_TRACKFIT_SYSTEM[libraryId];
    const resolvedSystemId = systemId ?? "unknown";
    if (!systemId) {
      unknownLibraries.add(libraryId);
    }

    const key = `${resolvedSystemId}\t${pieceCode}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, {
        system_id: resolvedSystemId,
        product_code: pieceCode,
        count: 1,
      });
    }
  }

  if (droppedPieces > 0) {
    result.warnings.push(
      `Ignored ${droppedPieces} <piece> element${droppedPieces === 1 ? "" : "s"} with missing library-id or piece-code`,
    );
  }
  if (unknownLibraries.size > 0 && !unknownLibraryWarned) {
    result.warnings.push(
      `Unknown AnyRail library id${unknownLibraries.size === 1 ? "" : "s"}: ${[...unknownLibraries].sort().join(", ")}`,
    );
  }

  result.requirements = [...byKey.values()];
  return result;
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const key = m[1];
    const val = m[3] ?? m[4] ?? "";
    if (key) out[key] = decodeXmlEntities(val);
  }
  return out;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    // amp last so we don't double-decode "&amp;lt;"
    .replace(/&amp;/g, "&");
}
