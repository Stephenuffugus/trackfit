import { useMemo } from "react";
import {
  suggestLayouts,
  type LayoutSuggestion,
  type SuggesterInventoryItem,
} from "@trackfit/layouts";
import type { TrackKind } from "@trackfit/library";
import type { InventoryRow } from "../lib/types";

interface Props {
  open: boolean;
  inventory: InventoryRow[];
  onClose: () => void;
}

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
 * Format the per-axis shortfall as a single English sentence. The suggester
 * already returns a rationale, but the shortfall list is the actionable
 * shopping list — surfaced separately so older users see the concrete
 * "1 turnout, 60° more curve" line.
 */
function formatShortfall(s: LayoutSuggestion): string {
  const parts: string[] = [];
  if (s.shortfall.straight_length_mm > 0) {
    parts.push(`${Math.round(s.shortfall.straight_length_mm)} mm more straight`);
  }
  if (s.shortfall.curve_total_degrees > 0) {
    parts.push(`${Math.round(s.shortfall.curve_total_degrees)}° more curve`);
  }
  if (s.shortfall.turnouts > 0) {
    parts.push(
      `${s.shortfall.turnouts} more turnout${s.shortfall.turnouts === 1 ? "" : "s"}`,
    );
  }
  if (s.shortfall.crossings > 0) {
    parts.push(
      `${s.shortfall.crossings} more crossing${s.shortfall.crossings === 1 ? "" : "s"}`,
    );
  }
  if (parts.length === 0) return "Nothing — you have everything.";
  return `You need: ${parts.join(", ")}.`;
}

/** Pick a status badge tone from the score and buildable flag. */
function statusBadge(s: LayoutSuggestion): { className: string; text: string } {
  if (s.buildable) return { className: "buildable", text: "✓ You can build this" };
  if (s.match_score >= 0.7) return { className: "close", text: "Close" };
  return { className: "far", text: "Far off" };
}

/**
 * Modal that answers "what can I build with this?". Pure rule-based —
 * runs on top of the user's existing inventory, no network calls.
 *
 * Renders up to 5 ranked layout suggestions. Each card carries:
 *   - the ASCII sketch (mono font, monospaced sizing in CSS)
 *   - layout name + plain-English description
 *   - 5-block match score bar
 *   - status badge (buildable / close / far)
 *   - shortfall as a "You need: ..." line
 *   - footprint
 *   - the suggester's rationale sentence
 */
export function LayoutSuggester({ open, inventory, onClose }: Props) {
  const suggestions = useMemo(() => {
    if (!open) return [] as LayoutSuggestion[];
    const items = rowsToSuggesterInventory(inventory);
    return suggestLayouts({ inventory: items }).slice(0, 5);
  }, [open, inventory]);

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

        {suggestions.length === 0 ? (
          <p className="hint">
            Add some track to your inventory first, then come back here.
          </p>
        ) : (
          <ul className="layout-suggester-list">
            {suggestions.map((s) => {
              const badge = statusBadge(s);
              const fp = s.template.footprint;
              return (
                <li key={s.template.id} className={`layout-card ${badge.className}`}>
                  <div className="layout-card-head">
                    <div>
                      <div className="layout-card-name">{s.template.name}</div>
                      <div className={`layout-card-badge ${badge.className}`}>
                        {badge.text}
                      </div>
                    </div>
                    <ScoreBar score={s.match_score} />
                  </div>

                  <pre className="layout-sketch">{s.template.ascii_sketch}</pre>

                  <p className="layout-card-desc">{s.template.description}</p>

                  <p className="layout-card-shortfall">{formatShortfall(s)}</p>

                  <p className="layout-card-rationale">{s.rationale}</p>

                  <p className="layout-card-footprint">
                    Footprint about {Math.round(fp.width_mm)} mm ×{" "}
                    {Math.round(fp.depth_mm)} mm
                  </p>
                </li>
              );
            })}
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
