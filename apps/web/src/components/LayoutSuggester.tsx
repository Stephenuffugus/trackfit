import { useEffect, useMemo, useState } from "react";
import {
  suggestLayouts,
  type LayoutShortfall,
  type LayoutSuggestion,
  type LayoutTemplate,
  type SuggesterInventoryItem,
} from "@trackfit/layouts";
import {
  searchLinks,
  searchLinksForMissingPiece,
  type MarketplaceLink,
} from "@trackfit/marketplace";
import type { Scale, TrackKind } from "@trackfit/library";
import type { InventoryRow, Unit } from "../lib/types";
import { IN_TO_MM, STORAGE_KEY } from "../lib/constants";

interface Props {
  open: boolean;
  inventory: InventoryRow[];
  onClose: () => void;
}

/**
 * Loose category for the filter chip row. Mirrors LayoutTemplate["style"]
 * plus an "any" sentinel for the default state.
 */
type StyleFilter = "any" | LayoutTemplate["style"];
type FootprintFilter = "any" | "small" | "medium" | "large";
type ScaleFilter = "any" | Scale;

/** All eight scales the library knows about. Kept in display order. */
const SCALE_OPTIONS: Scale[] = ["Z", "N", "TT", "HO", "OO", "S", "O", "G"];

/** Footprint thresholds, mm. Anything ≤ small is "small", ≤ medium is "medium", else "large". */
const SMALL_W = 1500;
const SMALL_D = 1000;
const MEDIUM_W = 2400;
const MEDIUM_D = 1500;

/**
 * Heuristic mapping for legacy inventory rows that don't carry a kind tag
 * (rows added before the v0.3 schema, or typed in by hand). Mirrors the
 * label-based check elsewhere in the app — keep these strings in sync.
 */
function inferKind(row: InventoryRow): TrackKind {
  if (row.kind) return row.kind;
  const label = row.label.toLowerCase();
  if (/turnout|switch/.test(label)) return "turnout";
  if (/cross/.test(label)) return "crossing";
  if (/curve/.test(label)) return "curve";
  if (/flex/.test(label)) return "flex";
  if (/fitter/.test(label)) return "fitter";
  if (/rerailer/.test(label)) return "rerailer";
  if (/bumper/.test(label)) return "bumper";
  return "straight";
}

/**
 * Translate the app's InventoryRow shape into the suggester's contract.
 * Strict on the kind field — the suggester needs it to bucket correctly.
 */
function rowsToSuggesterInventory(
  rows: InventoryRow[],
): SuggesterInventoryItem[] {
  return rows.map((row) => ({
    label: row.label,
    kind: inferKind(row),
    length_mm: row.length_mm,
    radius_mm: row.radius_mm ?? null,
    arc_degrees: row.arc_degrees ?? null,
    qty: row.qty,
  }));
}

/**
 * Read the user's persisted unit preference straight off localStorage. The
 * suggester modal is decoupled from App.tsx state to keep the prop surface
 * small; this is read-only so there's no sync risk.
 */
function readPersistedUnit(): Unit {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "in";
    const parsed = JSON.parse(raw) as { unit?: Unit };
    return parsed.unit === "mm" ? "mm" : "in";
  } catch {
    return "in";
  }
}

/**
 * Auto-detect the user's likely scale from their inventory radii.
 * HO inventory typically lives in the 350-700 mm range; N is 200-400 mm;
 * O is 700+ mm. We pick the scale most curves fall into. Returns "any"
 * when nothing in inventory carries a radius.
 */
function detectScale(rows: InventoryRow[]): ScaleFilter {
  const radii = rows
    .filter((r) => r.kind === "curve" && typeof r.radius_mm === "number")
    .map((r) => r.radius_mm as number)
    .filter((r) => r > 0);
  if (radii.length === 0) return "any";
  const median = radii.slice().sort((a, b) => a - b)[Math.floor(radii.length / 2)]!;
  if (median < 250) return "N";
  if (median < 450) return "HO";
  if (median < 800) return "OO";
  return "O";
}

/** Bucket a template's footprint into small/medium/large. */
function footprintBucket(tpl: LayoutTemplate): FootprintFilter {
  const w = tpl.footprint.width_mm;
  const d = tpl.footprint.depth_mm;
  if (w <= SMALL_W && d <= SMALL_D) return "small";
  if (w <= MEDIUM_W && d <= MEDIUM_D) return "medium";
  return "large";
}

/**
 * Render the match score as a 5-block bar (no decimals — older audiences
 * read "4 of 5 blocks lit" faster than "0.8").
 */
function ScoreBar({ score }: { score: number }) {
  const blocks = Math.round(Math.max(0, Math.min(1, score)) * 5);
  return (
    <span className="layout-score" aria-label={`Match score ${blocks} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`layout-score-block${i < blocks ? " on" : ""}`}
        />
      ))}
    </span>
  );
}

/**
 * Convert the per-axis shortfall into a single, conversational sentence.
 * The raw numbers ("90° curve, 250mm straight") are correct but not how a
 * hobbyist talks about their pile of track; we translate to "about 4 more
 * curve sections (~22.5°) and a 10-inch straight" with locale-aware units.
 */
function formatShortfallSentence(s: LayoutShortfall, unit: Unit): string {
  const parts: string[] = [];

  if (s.curve_total_degrees > 0) {
    const deg = s.curve_total_degrees;
    // Pick a "section size" the hobbyist will recognise: standard 22.5°
    // unless the shortfall is a clean multiple of a bigger arc.
    const ARC_PRESETS = [90, 45, 30, 22.5];
    let sectionDeg = 22.5;
    let sections = Math.max(1, Math.ceil(deg / 22.5));
    if (deg >= 90) {
      // Round to nearest preset arc that divides cleanly.
      for (const arc of ARC_PRESETS) {
        if (Math.abs(deg / arc - Math.round(deg / arc)) < 0.05) {
          sectionDeg = arc;
          sections = Math.round(deg / arc);
          break;
        }
      }
    }
    parts.push(
      `about ${sections} more curve section${sections === 1 ? "" : "s"} (~${sectionDeg}°)`,
    );
  }

  if (s.straight_length_mm > 0) {
    if (unit === "in") {
      const inches = s.straight_length_mm / IN_TO_MM;
      // Round to nearest 0.5".
      const rounded = Math.max(0.5, Math.round(inches * 2) / 2);
      const display = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
      parts.push(`a ${display}-inch straight`);
    } else {
      // Round to nearest 10mm for clean reading.
      const mm = Math.max(10, Math.round(s.straight_length_mm / 10) * 10);
      parts.push(`about ${mm} mm of straight track`);
    }
  }

  if (s.turnouts > 0) {
    parts.push(`${s.turnouts} more turnout${s.turnouts === 1 ? "" : "s"}`);
  }
  if (s.crossings > 0) {
    parts.push(`${s.crossings} more crossing${s.crossings === 1 ? "" : "s"}`);
  }

  if (parts.length === 0) return "Nothing — you have everything.";
  return `You'd need ${joinWithAnd(parts)}.`;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** Pick a status badge tone from the score and buildable flag. */
function statusBadge(s: LayoutSuggestion): {
  className: string;
  text: string;
} {
  if (s.buildable) {
    return { className: "buildable", text: "✓ Buildable" };
  }
  if (s.match_score >= 0.7) {
    // Pull the most-actionable single deficit into the badge for at-a-glance
    // scan; the full sentence renders below.
    const need = primaryNeed(s);
    return { className: "close", text: `Almost (need ${need})` };
  }
  const need = primaryNeed(s);
  return { className: "far", text: `Far (need ${need})` };
}

/**
 * Summarise the *biggest* missing axis in two or three words for the badge.
 * The full plain-English sentence still renders below; this is for the chip.
 */
function primaryNeed(s: LayoutSuggestion): string {
  const sf = s.shortfall;
  const t = s.template.requirements;
  // Score each axis by its share-of-requirement so we pick the single
  // dominant gap rather than the largest absolute number.
  const axes: { kind: string; ratio: number }[] = [];
  if (t.straight_length_mm > 0) {
    axes.push({
      kind: "straight",
      ratio: sf.straight_length_mm / t.straight_length_mm,
    });
  }
  if (t.curve_total_degrees > 0) {
    axes.push({
      kind: "curve",
      ratio: sf.curve_total_degrees / t.curve_total_degrees,
    });
  }
  if ((t.turnouts ?? 0) > 0) {
    axes.push({ kind: "turnouts", ratio: sf.turnouts / (t.turnouts as number) });
  }
  if ((t.crossings ?? 0) > 0) {
    axes.push({
      kind: "crossings",
      ratio: sf.crossings / (t.crossings as number),
    });
  }
  axes.sort((a, b) => b.ratio - a.ratio);
  const top = axes[0]?.kind;
  if (top === "straight") return "more straight";
  if (top === "curve") return "more curve";
  if (top === "turnouts") return "turnouts";
  if (top === "crossings") return "a crossing";
  return "more track";
}

/**
 * Build the marketplace links for a layout's shortfall. We hit the most
 * impactful axis (the one with the largest share-of-requirement) so the
 * user sees "buy this curve set" not eight unrelated dealer pages.
 */
function buildShoppingLinks(
  s: LayoutSuggestion,
  scale: ScaleFilter,
): MarketplaceLink[] {
  const sf = s.shortfall;
  const scaleHint: Scale | undefined = scale === "any" ? undefined : scale;

  if (sf.curve_total_degrees > 0) {
    return searchLinksForMissingPiece(
      {
        kind: "curve",
        arc_degrees: 22.5,
        label: "curve track section",
      },
      { scale: scaleHint },
    ).slice(0, 4);
  }
  if (sf.straight_length_mm > 0) {
    return searchLinksForMissingPiece(
      {
        kind: "straight",
        length_mm: sf.straight_length_mm,
      },
      { scale: scaleHint },
    ).slice(0, 4);
  }
  if (sf.turnouts > 0) {
    return searchLinks(
      {
        query: `${scaleHint ?? ""} scale turnout`.trim(),
        scale: scaleHint,
      },
    ).slice(0, 4);
  }
  if (sf.crossings > 0) {
    return searchLinks(
      {
        query: `${scaleHint ?? ""} scale track crossing`.trim(),
        scale: scaleHint,
      },
    ).slice(0, 4);
  }
  return [];
}

/**
 * One layout result card. Self-contained so the open/close state per-card
 * doesn't lift up into the modal — keeps the parent component simple.
 */
function LayoutCard({
  suggestion,
  unit,
  scale,
}: {
  suggestion: LayoutSuggestion;
  unit: Unit;
  scale: ScaleFilter;
}) {
  const [showLinks, setShowLinks] = useState(false);
  const badge = statusBadge(suggestion);
  const fp = suggestion.template.footprint;
  const shortfallSentence = formatShortfallSentence(
    suggestion.shortfall,
    unit,
  );

  const links = useMemo(
    () => (showLinks ? buildShoppingLinks(suggestion, scale) : []),
    [showLinks, suggestion, scale],
  );

  return (
    <li className={`layout-card ${badge.className}`}>
      <div className="layout-card-head">
        <div className="layout-card-name">{suggestion.template.name}</div>
        <div className={`layout-card-badge ${badge.className}`}>
          {badge.text}
        </div>
      </div>

      <pre className="layout-sketch">{suggestion.template.ascii_sketch}</pre>

      <p className="layout-card-appeal">{suggestion.template.appeal}</p>
      <p className="layout-card-desc">{suggestion.template.description}</p>
      <p className="layout-card-footprint">
        Footprint about {Math.round(fp.width_mm)} mm ×{" "}
        {Math.round(fp.depth_mm)} mm
      </p>

      <div className="layout-card-scorerow">
        <ScoreBar score={suggestion.match_score} />
        {!suggestion.buildable ? (
          <span className="layout-card-shortsentence">{shortfallSentence}</span>
        ) : null}
      </div>

      {suggestion.buildable ? (
        <button type="button" className="btn layout-card-build">
          Build this
        </button>
      ) : (
        <div className="layout-card-shop">
          <button
            type="button"
            className="layout-card-shop-toggle"
            onClick={() => setShowLinks((v) => !v)}
            aria-expanded={showLinks}
          >
            {showLinks ? "Hide" : "Where to buy missing pieces"}
            <span aria-hidden="true">{showLinks ? " ▲" : " ▼"}</span>
          </button>
          {showLinks ? (
            <ul className="layout-card-shop-list">
              {links.map((link) => (
                <li key={link.vendor}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                  <span className="layout-card-shop-rationale">
                    {link.rationale}
                  </span>
                </li>
              ))}
              {links.length === 0 ? (
                <li className="hint">No vendor suggestions for this gap.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      )}
    </li>
  );
}

/**
 * Filter chip row. Single-select; the active value re-renders the parent's
 * `useMemo` filter pipeline.
 */
function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
  counts,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="layout-filter-row">
      <span className="layout-filter-label">{label}</span>
      <div className="layout-filter-chips">
        {options.map((opt) => {
          const count = counts?.[opt.value];
          const showCount = typeof count === "number" && opt.value !== "any";
          return (
            <button
              type="button"
              key={opt.value}
              className={`chip${value === opt.value ? " active" : ""}`}
              onClick={() => onChange(opt.value)}
              aria-pressed={value === opt.value}
            >
              {opt.label}
              {showCount ? <span className="chip-count"> ({count})</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Modal that answers "what can I build with this?". Pure rule-based —
 * runs on top of the user's existing inventory, no network calls.
 *
 * v0.3.1 — adds three filter chip rows (style, footprint, scale), an
 * appeal pitch, plain-English shortfall sentences, and a marketplace
 * expander on near-miss cards. The suggester engine itself is unchanged;
 * filtering happens UI-side so we keep the deterministic ranking.
 */
export function LayoutSuggester({ open, inventory, onClose }: Props) {
  const [styleFilter, setStyleFilter] = useState<StyleFilter>("any");
  const [footprintFilter, setFootprintFilter] = useState<FootprintFilter>("any");
  // Auto-detect from inventory when the modal mounts; user can override.
  const [scaleFilter, setScaleFilter] = useState<ScaleFilter>("any");
  const [scaleAutoDetected, setScaleAutoDetected] = useState(false);

  // Cache the user's unit preference at modal open so re-renders don't
  // re-read localStorage on every keystroke.
  const unit = useMemo(() => (open ? readPersistedUnit() : "in"), [open]);

  // First-open scale detection. We don't override an explicit user choice;
  // when the modal closes we reset so the next open re-detects from a
  // possibly-changed inventory.
  useEffect(() => {
    if (open && !scaleAutoDetected) {
      const detected = detectScale(inventory);
      if (detected !== "any" && scaleFilter === "any") {
        setScaleFilter(detected);
      }
      setScaleAutoDetected(true);
    } else if (!open && scaleAutoDetected) {
      setScaleAutoDetected(false);
    }
  }, [open, inventory, scaleAutoDetected, scaleFilter]);

  const allSuggestions = useMemo(() => {
    if (!open) return [] as LayoutSuggestion[];
    const items = rowsToSuggesterInventory(inventory);
    return suggestLayouts({
      inventory: items,
      scale: scaleFilter !== "any" ? (scaleFilter as Scale) : undefined,
    });
  }, [open, inventory, scaleFilter]);

  // Counts per chip — compute against the post-scale list so the numbers
  // reflect what the user can actually pick.
  const styleCounts = useMemo(() => {
    const counts: Record<StyleFilter, number> = {
      any: allSuggestions.length,
      "continuous-loop": 0,
      switching: 0,
      showcase: 0,
      starter: 0,
    };
    for (const s of allSuggestions) counts[s.template.style] += 1;
    return counts;
  }, [allSuggestions]);

  const footprintCounts = useMemo(() => {
    const counts: Record<FootprintFilter, number> = {
      any: allSuggestions.length,
      small: 0,
      medium: 0,
      large: 0,
    };
    for (const s of allSuggestions) counts[footprintBucket(s.template)] += 1;
    return counts;
  }, [allSuggestions]);

  const scaleCounts = useMemo(() => {
    const counts: Record<ScaleFilter, number> = {
      any: 0,
      Z: 0,
      N: 0,
      TT: 0,
      HO: 0,
      OO: 0,
      S: 0,
      O: 0,
      G: 0,
    };
    counts.any = allSuggestions.length;
    for (const s of allSuggestions) {
      const scales = s.template.scales;
      if (scales === null) {
        // Universal templates count for every scale chip.
        for (const sc of SCALE_OPTIONS) counts[sc] += 1;
      } else {
        for (const sc of scales) counts[sc] += 1;
      }
    }
    return counts;
  }, [allSuggestions]);

  const filtered = useMemo(() => {
    return allSuggestions.filter((s) => {
      if (styleFilter !== "any" && s.template.style !== styleFilter) {
        return false;
      }
      if (
        footprintFilter !== "any" &&
        footprintBucket(s.template) !== footprintFilter
      ) {
        return false;
      }
      // Scale is already applied in the suggester call when set, but a
      // template with `scales: null` still passes — that's correct. No
      // additional client-side filter needed.
      return true;
    });
  }, [allSuggestions, styleFilter, footprintFilter]);

  if (!open) return null;

  return (
    <div
      className="modal open layout-suggester-modal"
      role="dialog"
      aria-modal="true"
      aria-label="What can I build with my inventory?"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner layout-suggester-inner">
        <div className="layout-suggester-head">
          <h2>What can I build?</h2>
          <p className="hint">
            Based on the track in your inventory. We'll show what you can
            build today and what you're close to.
          </p>
        </div>

        <div className="layout-suggester-filters">
          <ChipRow<StyleFilter>
            label="Style"
            value={styleFilter}
            onChange={setStyleFilter}
            counts={styleCounts}
            options={[
              { value: "any", label: "Any" },
              { value: "continuous-loop", label: "Continuous loop" },
              { value: "switching", label: "Switching" },
              { value: "showcase", label: "Showcase" },
              { value: "starter", label: "Beginner" },
            ]}
          />
          <ChipRow<FootprintFilter>
            label="Footprint"
            value={footprintFilter}
            onChange={setFootprintFilter}
            counts={footprintCounts}
            options={[
              { value: "any", label: "Any" },
              { value: "small", label: "Small (≤ 1.5 m × 1 m)" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
          />
          <ChipRow<ScaleFilter>
            label="Scale"
            value={scaleFilter}
            onChange={setScaleFilter}
            counts={scaleCounts}
            options={[
              { value: "any", label: "Any" },
              ...SCALE_OPTIONS.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="hint">
            {allSuggestions.length === 0
              ? "Add some track to your inventory first, then come back here."
              : "No layouts match those filters. Try widening one of the chips."}
          </p>
        ) : (
          <ul className="layout-suggester-list">
            {filtered.map((s) => (
              <LayoutCard
                key={s.template.id}
                suggestion={s}
                unit={unit}
                scale={scaleFilter}
              />
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
