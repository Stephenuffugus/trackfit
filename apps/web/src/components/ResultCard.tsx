import type {
  CurveMissingPiece,
  CurveSolution,
  Solution,
} from "@trackfit/solver";
import { listSystems, type Scale, type TrackSystem } from "@trackfit/library";
import { IN_TO_MM } from "../lib/constants";
import { unitSuffix } from "../lib/format";
import { inferSystemForRows } from "../lib/presets";
import type { Unit } from "../lib/types";
import { CutTemplateButton } from "./CutTemplateButton";
import { MarketplaceLinks } from "./MarketplaceLinks";

export type ResultKind = "fit" | "under" | "over";

/**
 * The card consumes either a v0.2 1D Solution (straight gap) or a 2D
 * CurveSolution. Both shapes share the same essentials (pieces, total length,
 * piece count, deviation/score) — we normalize on render.
 */
type AnySolution = Solution | CurveSolution;

interface Props {
  solution: AnySolution;
  kind: ResultKind;
  unit: Unit;
  target_mm: number;
  /** stable color per piece label across this solve */
  labelColors: Record<string, string>;
  /**
   * Flex pieces from the user's inventory. Drilled in from App.tsx via
   * ResultsList so the SUGGESTED callout can offer a 1:1 cut template when
   * there's at least one flex source on hand.
   */
  flexCandidates: { label: string; length_mm: number }[];
  /**
   * Optional curve-suggestion union, surfaced from `CurveSolverResult.suggestion`.
   * Only relevant on under-miss curve cards; ignored otherwise.
   */
  curveSuggestion?: CurveMissingPiece | null;
}

/** Type-guard: does this solution come from the curve solver? */
function isCurveSolution(s: AnySolution): s is CurveSolution {
  return (
    typeof (s as CurveSolution).total_arc_length_mm === "number" ||
    "endpoint" in s
  );
}

/**
 * Render a single result card — exact-fit, close-fit, or near-miss
 * (under/over). The under-miss variant carries the "SUGGESTED" stamp with
 * the precise missing-piece length, which is v0.2's killer feature.
 */
export function ResultCard({
  solution,
  kind,
  unit,
  target_mm,
  labelColors,
  flexCandidates,
  curveSuggestion = null,
}: Props) {
  const u = unitSuffix(unit);
  const isCurve = isCurveSolution(solution);

  // The 1D Solution carries `deviation_mm`; the 2D CurveSolution carries a
  // 3-axis `residual` and a normalized `score`. For the card header we want
  // the most useful single scalar — for curve solutions that's the longitudinal
  // residual, which is what users intuit as "off by N mm".
  const total_mm = isCurve
    ? (solution as CurveSolution).total_arc_length_mm
    : (solution as Solution).total_mm;
  const deviation_mm = isCurve
    ? Math.abs((solution as CurveSolution).residual.length_mm)
    : (solution as Solution).deviation_mm;
  const isExact = isCurve
    ? (solution as CurveSolution).score < 0.01
    : deviation_mm < 0.01;

  const totalDisplay =
    unit === "in"
      ? parseFloat((total_mm / IN_TO_MM).toFixed(4))
      : parseFloat(total_mm.toFixed(2));
  const devDisplay =
    unit === "in"
      ? parseFloat((deviation_mm / IN_TO_MM).toFixed(4))
      : parseFloat(deviation_mm.toFixed(2));

  // Build flat segment list for the multi-color piece bar.
  // Curve solutions list every step individually (count: 1 per step + a
  // direction), so we can iterate the same way as the 1D solver's pieces.
  type Seg = {
    length_mm: number;
    color: string;
    label: string;
    kind?: string;
    direction?: 1 | -1;
  };
  const segments: Seg[] = [];
  solution.pieces.forEach((p) => {
    const pKind = (p as { kind?: string }).kind;
    const dir = (p as { direction?: 1 | -1 }).direction;
    for (let n = 0; n < p.count; n++) {
      segments.push({
        length_mm: p.length_mm,
        color: labelColors[p.label] || "var(--ink-soft)",
        label: p.label,
        ...(pKind ? { kind: pKind } : {}),
        ...(dir != null ? { direction: dir } : {}),
      });
    }
  });
  const barTotal = segments.reduce((a, s) => a + s.length_mm, 0);
  const includesCurve = segments.some((s) => s.kind === "curve");

  let statusClass: "exact" | "close" | "miss";
  let statusText: string;
  let cardClass = "result-card";
  if (kind === "fit") {
    statusClass = isExact ? "exact" : "close";
    statusText = isExact ? "✓ Exact fit" : `Within ${devDisplay}${u}`;
  } else if (kind === "under") {
    statusClass = "miss";
    statusText = `Closest under · short by ${devDisplay}${u}`;
    cardClass += " near-miss";
  } else {
    statusClass = "miss";
    statusText = `Closest over · long by ${devDisplay}${u}`;
    cardClass += " near-miss";
  }
  if (includesCurve) {
    statusText += " (includes a curve)";
  }

  const joints = solution.pieceCount - 1;

  // Suggestion rendering ------------------------------------------------------
  // 1D path keeps the v0.2 string. Curve path consumes the solver's typed
  // CurveMissingPiece union — three flavors (straight / curve / mixed).
  //
  // The "Where to buy" panel needs a system hint to bias the vendor search.
  // We infer from the solution's pieces by label-matching against the
  // library — if every label belongs to one system, that's our hint;
  // otherwise the most-represented system wins. inferSystemForRows handles
  // both cases.
  const systemHint = buildSystemHint(solution.pieces);
  // For mixed-brand combos, note how many pieces fall outside the
  // dominant brand so the user isn't misled when the marketplace panel
  // surfaces only one vendor list (focus-group P2-T2-F3).
  const otherBrandCount = otherBrandPieceCount(solution.pieces, systemHint?.id);
  const otherBrandNote =
    otherBrandCount > 0 ? (
      <p className="suggest-mixed-brand-note">
        ({otherBrandCount} other brand{" "}
        {otherBrandCount === 1 ? "piece" : "pieces"} in this combo)
      </p>
    ) : null;
  let suggestNode: React.ReactNode = null;
  if (kind === "under" && !isCurve) {
    const missing_mm = target_mm - total_mm;
    const missingDisplay =
      unit === "in"
        ? parseFloat((missing_mm / IN_TO_MM).toFixed(3))
        : parseFloat(missing_mm.toFixed(2));
    suggestNode = (
      <div className="suggest">
        Add this combo plus a single{" "}
        <span className="qty">
          {missingDisplay}
          {u}
        </span>{" "}
        piece to your inventory for an exact fit.
        <CutTemplateButton
          missingLengthMm={missing_mm}
          flexCandidates={flexCandidates}
        />
        <MarketplaceLinks
          missingPiece={{ kind: "straight", length_mm: missing_mm }}
          systemHint={systemHint}
        />
        {otherBrandNote}
      </div>
    );
  } else if (kind === "under" && isCurve && curveSuggestion) {
    suggestNode = (
      <div className="suggest">
        <CurveSuggestionBody
          suggestion={curveSuggestion}
          unit={unit}
          flexCandidates={flexCandidates}
        />
        <CurveSuggestionMarketplace
          suggestion={curveSuggestion}
          systemHint={systemHint}
        />
        {otherBrandNote}
      </div>
    );
  }

  // Total label: curves report path length, not chord — flag with "~".
  const totalPrefix = isCurve ? "~" : "";
  const totalAriaLabel = isCurve
    ? `Total path length about ${totalDisplay}${u}`
    : `Total length ${totalDisplay}${u}`;

  return (
    <div className={cardClass}>
      <div className="result-head">
        <div>
          <div className={`result-status ${statusClass}`}>{statusText}</div>
          <div className="meta">
            {solution.pieceCount} piece
            {solution.pieceCount === 1 ? "" : "s"} · {joints} joint
            {joints === 1 ? "" : "s"}
            {isCurve ? " · total path" : ""}
          </div>
        </div>
        <div className="result-total" aria-label={totalAriaLabel}>
          {totalPrefix}
          {totalDisplay}
          {u}
        </div>
      </div>
      <div className="bar">
        {segments.map((s, i) => {
          const pct = (s.length_mm / barTotal) * 100;
          const lenLabel =
            unit === "in"
              ? parseFloat((s.length_mm / IN_TO_MM).toFixed(2))
              : Math.round(s.length_mm);
          const isCurveSeg = s.kind === "curve";
          const glyph = isCurveSeg
            ? s.direction === -1
              ? "↶"
              : "↻"
            : null;
          return (
            <div
              key={i}
              className={`bar-seg${isCurveSeg ? " bar-seg--curve" : ""}`}
              style={{ width: `${pct.toFixed(2)}%`, background: s.color }}
              title={`${s.label}: ${lenLabel}${u}${
                isCurveSeg
                  ? ` (curve, ${s.direction === -1 ? "right" : "left"})`
                  : ""
              }`}
            >
              {glyph && pct > 4 ? (
                <span className="bar-seg__glyph" aria-hidden="true">
                  {glyph}
                </span>
              ) : null}
              {pct > 6 ? lenLabel : ""}
            </div>
          );
        })}
      </div>
      <div className="pieces-list">
        {/* For curve solutions every entry has count: 1 — group by label so
            the chip list stays readable on chains of 6+ pieces. */}
        {summarizePieces(solution.pieces).map((p, i) => (
          <span key={i} className="pchip">
            <span
              className="swatch"
              style={{ background: labelColors[p.label] }}
            />
            {p.count}× {p.label}
            {p.curve ? " ↻" : ""}
          </span>
        ))}
      </div>
      {suggestNode}
    </div>
  );
}

/** Aggregate `pieces` for the chip list. Direction is dropped here on
 *  purpose — the bar above carries the per-step ↻/↶ signal. */
function summarizePieces(
  pieces: AnySolution["pieces"],
): { label: string; count: number; curve: boolean }[] {
  const map = new Map<string, { count: number; curve: boolean }>();
  for (const p of pieces) {
    const cur = map.get(p.label) ?? { count: 0, curve: false };
    cur.count += p.count;
    if ((p as { kind?: string }).kind === "curve") cur.curve = true;
    map.set(p.label, cur);
  }
  return Array.from(map.entries()).map(([label, v]) => ({
    label,
    count: v.count,
    curve: v.curve,
  }));
}

interface CurveSuggestionBodyProps {
  suggestion: CurveMissingPiece;
  unit: Unit;
  flexCandidates: { label: string; length_mm: number }[];
}

/** Plain-English render of the curve solver's typed missing-piece union. */
function CurveSuggestionBody({
  suggestion,
  unit,
  flexCandidates,
}: CurveSuggestionBodyProps) {
  if (suggestion.kind === "straight") {
    const u = unitSuffix(unit);
    const display =
      unit === "in"
        ? parseFloat((suggestion.length_mm / IN_TO_MM).toFixed(3))
        : parseFloat(suggestion.length_mm.toFixed(2));
    return (
      <>
        Add a straight piece of{" "}
        <span className="qty">
          {display}
          {u}
        </span>{" "}
        to close it exactly.
        <CutTemplateButton
          missingLengthMm={suggestion.length_mm}
          flexCandidates={flexCandidates}
        />
      </>
    );
  }
  if (suggestion.kind === "curve") {
    return (
      <>
        A single curve, radius{" "}
        <span className="qty">{suggestion.radius_mm} mm</span>, arc{" "}
        <span className="qty">{suggestion.arc_degrees}°</span>, would close it.
        {suggestion.below_nmra_minimum ? (
          <p className="suggest-warning">
            Note: this radius is tighter than NMRA RP-11 recommends for this
            scale. Longer locos may not run reliably through it.
          </p>
        ) : null}
      </>
    );
  }
  // mixed
  return <>{suggestion.message}</>;
}

/**
 * Inspect a solver Solution's pieces and return a marketplace SystemHint —
 * { id, manufacturer, scale } — derived from whichever library system the
 * pieces most plausibly belong to. Returns undefined when no library piece
 * labels match (manual / cut-down inventory).
 *
 * Honors per-piece `system_id` when present (focus-group P2-T2-F3) so a
 * mixed-brand inventory routes vendors by the dominant brand rather than
 * silently inheriting whichever preset was loaded first.
 */
function buildSystemHint(
  pieces: AnySolution["pieces"],
): { id: string; manufacturer: string; scale?: Scale } | undefined {
  const sys: TrackSystem | undefined = inferSystemForRows(
    pieces.map((p) => ({
      label: p.label,
      system_id: (p as { system_id?: string }).system_id,
    })),
    listSystems(),
  );
  if (!sys) return undefined;
  return {
    id: sys.id,
    manufacturer: sys.manufacturer,
    scale: sys.scale,
  };
}

/**
 * Count solution pieces whose explicit `system_id` differs from the
 * dominant-brand `systemHint.id`. Returned count drives the inline
 * "(N other brand pieces in this combo)" note next to the marketplace
 * panel — see focus-group P2-T2-F3. Only pieces with a known system_id
 * are tallied; hand-typed rows are silent.
 */
function otherBrandPieceCount(
  pieces: AnySolution["pieces"],
  dominantSystemId: string | undefined,
): number {
  if (!dominantSystemId) return 0;
  let n = 0;
  for (const p of pieces) {
    const sid = (p as { system_id?: string }).system_id;
    if (sid && sid !== dominantSystemId) {
      // Each row carries a `count`; weigh by it so a 6-of-a-kind row
      // shows as 6 mismatched pieces, not one.
      const cnt = (p as { count?: number }).count;
      n += typeof cnt === "number" && cnt > 0 ? cnt : 1;
    }
  }
  return n;
}

interface CurveSuggestionMarketplaceProps {
  suggestion: CurveMissingPiece;
  systemHint?: { id: string; manufacturer: string; scale?: Scale };
}

/**
 * Wraps MarketplaceLinks for the curve-suggestion union. The `mixed` flavor
 * doesn't expose a single piece to search for, so we suppress the panel
 * there — clutter beats utility for a multi-piece composite suggestion.
 */
function CurveSuggestionMarketplace({
  suggestion,
  systemHint,
}: CurveSuggestionMarketplaceProps) {
  if (suggestion.kind === "straight") {
    return (
      <MarketplaceLinks
        missingPiece={{ kind: "straight", length_mm: suggestion.length_mm }}
        systemHint={systemHint}
      />
    );
  }
  if (suggestion.kind === "curve") {
    return (
      <MarketplaceLinks
        missingPiece={{
          kind: "curve",
          radius_mm: suggestion.radius_mm,
          arc_degrees: suggestion.arc_degrees,
        }}
        systemHint={systemHint}
      />
    );
  }
  return null;
}
