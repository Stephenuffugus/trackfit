import type { Solution } from "@trackfit/solver";
import { IN_TO_MM } from "../lib/constants";
import { unitSuffix } from "../lib/format";
import type { Unit } from "../lib/types";

export type ResultKind = "fit" | "under" | "over";

interface Props {
  solution: Solution;
  kind: ResultKind;
  unit: Unit;
  target_mm: number;
  /** stable color per piece label across this solve */
  labelColors: Record<string, string>;
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
}: Props) {
  const u = unitSuffix(unit);
  const isExact = solution.deviation_mm < 0.01;
  const totalDisplay =
    unit === "in"
      ? parseFloat((solution.total_mm / IN_TO_MM).toFixed(4))
      : parseFloat(solution.total_mm.toFixed(2));
  const devDisplay =
    unit === "in"
      ? parseFloat((solution.deviation_mm / IN_TO_MM).toFixed(4))
      : parseFloat(solution.deviation_mm.toFixed(2));

  // Build flat segment list for the multi-color piece bar.
  const segments: { length_mm: number; color: string; label: string }[] = [];
  solution.pieces.forEach((p) => {
    for (let n = 0; n < p.count; n++) {
      segments.push({
        length_mm: p.length_mm,
        color: labelColors[p.label] || "var(--ink-soft)",
        label: p.label,
      });
    }
  });
  const barTotal = segments.reduce((a, s) => a + s.length_mm, 0);

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

  const joints = solution.pieceCount - 1;

  let suggestNode: React.ReactNode = null;
  if (kind === "under") {
    const missing_mm = target_mm - solution.total_mm;
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
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <div className="result-head">
        <div>
          <div className={`result-status ${statusClass}`}>{statusText}</div>
          <div className="meta">
            {solution.pieceCount} piece
            {solution.pieceCount === 1 ? "" : "s"} · {joints} joint
            {joints === 1 ? "" : "s"}
          </div>
        </div>
        <div className="result-total">
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
          return (
            <div
              key={i}
              className="bar-seg"
              style={{ width: `${pct.toFixed(2)}%`, background: s.color }}
              title={`${s.label}: ${lenLabel}${u}`}
            >
              {pct > 6 ? lenLabel : ""}
            </div>
          );
        })}
      </div>
      <div className="pieces-list">
        {solution.pieces.map((p, i) => (
          <span key={i} className="pchip">
            <span
              className="swatch"
              style={{ background: labelColors[p.label] }}
            />
            {p.count}× {p.label}
          </span>
        ))}
      </div>
      {suggestNode}
    </div>
  );
}
