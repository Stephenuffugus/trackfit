import { useMemo, useState } from "react";
import { findLoops, tracePlan, type LoopPlan, type LoopResult } from "@trackfit/solver";
import { listSystems } from "@trackfit/library";
import type { InventoryRow, Unit } from "../lib/types";
import { formatLength, parseLengthExpression, unitSuffix } from "../lib/format";
import { IN_TO_MM } from "../lib/constants";

interface Props {
  inventory: InventoryRow[];
  unit: Unit;
}

/** Feet and inches, or metres, for a footprint a person can picture. */
export function roomSize(mm: number, unit: Unit): string {
  if (unit === "in") {
    const totalIn = Math.ceil(mm / IN_TO_MM);
    const ft = Math.floor(totalIn / 12);
    const inch = totalIn % 12;
    if (ft === 0) return `${inch} in`;
    return inch ? `${ft} ft ${inch} in` : `${ft} ft`;
  }
  return `${(Math.ceil(mm / 10) / 100).toFixed(2)} m`;
}

/**
 * "What loops can I build?" Uses only what the user owns, one track
 * system at a time, and shows each answer as a drawing plus a parts list.
 */
export function LoopBuilder({ inventory, unit }: Props) {
  const [tableW, setTableW] = useState("");
  const [tableD, setTableD] = useState("");
  const [result, setResult] = useState<LoopResult | null>(null);
  const [printing, setPrinting] = useState<number | null>(null);

  const systemNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of listSystems()) m.set(s.id, s.name);
    return m;
  }, []);

  const run = () => {
    const w = parseLengthExpression(tableW, unit);
    const d = parseLengthExpression(tableD, unit);
    // Table edge to track centre: leave half a tie width plus a little
    // margin on every side, so a plan that "fits" really fits.
    const margin = 2 * 40;
    const pieces = inventory
      .filter((r) => r.kind === "straight" || r.kind === "fitter" || r.kind === "rerailer" || r.kind === "uncoupler" || r.kind === "curve" || (r.kind === undefined && r.length_mm > 0))
      .map((r) => ({
        label: r.label,
        kind: (r.kind === "curve" ? "curve" : "straight") as "curve" | "straight",
        length_mm: r.length_mm,
        radius_mm: r.radius_mm,
        arc_degrees: r.arc_degrees,
        qty: r.qty,
        system_id: r.system_id,
      }));
    setResult(
      findLoops(pieces, {
        maxWidthMm: w && w.mm > 0 ? w.mm - margin : undefined,
        maxDepthMm: d && d.mm > 0 ? d.mm - margin : undefined,
      }),
    );
  };

  const printPlan = (i: number) => {
    setPrinting(i);
    document.body.classList.add("printing-plan");
    const done = () => {
      document.body.classList.remove("printing-plan");
      setPrinting(null);
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.setTimeout(() => window.print(), 50);
  };

  const empty = inventory.length === 0;

  return (
    <section className="app-section loop-builder" aria-labelledby="loop-builder-title">
      <p className="label" id="loop-builder-title">Step 3 · What can I build?</p>
      <div className="card loop-builder__card">
        <p className="loop-builder__lead">
          Find complete loops (circles and ovals) you can build today with only
          the pieces in your box.
        </p>
        <div className="loop-builder__table">
          <p className="loop-builder__table-q">
            Room on your table? <span className="muted">(optional)</span>
          </p>
          <div className="loop-builder__table-row">
            <label>
              <span>Width</span>
              <input
                type="text"
                inputMode="decimal"
                value={tableW}
                placeholder={unit === "in" ? "e.g. 60" : "e.g. 1500"}
                onChange={(e) => setTableW(e.target.value)}
              />
            </label>
            <span aria-hidden="true" className="loop-builder__x">×</span>
            <label>
              <span>Depth</span>
              <input
                type="text"
                inputMode="decimal"
                value={tableD}
                placeholder={unit === "in" ? "e.g. 40" : "e.g. 1000"}
                onChange={(e) => setTableD(e.target.value)}
              />
            </label>
            <span className="loop-builder__unit">{unit === "in" ? "inches" : "mm"}</span>
          </div>
        </div>
        <button type="button" className="solve loop-builder__go" onClick={run} disabled={empty}>
          Show loops I can build →
        </button>
        {empty ? (
          <p className="loop-builder__hint">Add your track above first.</p>
        ) : null}
      </div>

      {result ? (
        result.plans.length === 0 ? (
          <div className="card loop-builder__none" role="status">
            <p className="loop-builder__none-title">No complete loop yet.</p>
            {result.reason ? <p>{result.reason}</p> : null}
            {result.nearest ? <p>{result.nearest}</p> : null}
          </div>
        ) : (
          <ol className="loop-list" aria-label="Loops you can build">
            {result.plans.map((plan, i) => (
              <LoopCard
                key={i}
                plan={plan}
                unit={unit}
                systemName={plan.system_id ? systemNames.get(plan.system_id) : undefined}
                printing={printing === i}
                onPrint={() => printPlan(i)}
              />
            ))}
          </ol>
        )
      ) : null}
    </section>
  );
}

function LoopCard({
  plan,
  unit,
  systemName,
  printing,
  onPrint,
}: {
  plan: LoopPlan;
  unit: Unit;
  systemName?: string;
  printing: boolean;
  onPrint: () => void;
}) {
  const title =
    plan.shape === "circle"
      ? "Circle"
      : `Oval, ${formatLength(plan.side_mm, unit)}${unitSuffix(unit)} straight sides`;
  return (
    <li className={`card loop-card${printing ? " print-me" : ""}`}>
      <h3 className="loop-card__title">{title}</h3>
      <p className="loop-card__size">
        Needs about <strong>{roomSize(plan.width_mm + 80, unit)} × {roomSize(plan.depth_mm + 80, unit)}</strong>
        {" "}of table ({plan.total_pieces} pieces{systemName ? `, ${systemName}` : ""}).
      </p>
      <LoopDrawing plan={plan} />
      <p className="loop-card__legend">
        <span className="swatch swatch--straight" /> straight
        <span className="swatch swatch--curve" /> curve
        <span className="muted"> · ticks show where pieces join</span>
      </p>
      <table className="loop-card__parts">
        <caption>Pieces to take out of the box</caption>
        <tbody>
          {plan.parts.map((p, k) => (
            <tr key={k}>
              <td className="loop-card__count">{p.count} ×</td>
              <td>{p.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="loop-card__how">
        Lay half the straights in a row, then curves until the track has
        turned right round, then the rest of the straights, then the rest of the
        curves. It closes on the first piece.
      </p>
      <button type="button" className="btn loop-card__print" onClick={onPrint}>
        Print this plan
      </button>
    </li>
  );
}

export function LoopDrawing({ plan, size = 320 }: { plan: LoopPlan; size?: number }) {
  const { segments } = tracePlan(plan);
  // Bounds: the circle centres sit on the left side of travel, so include
  // every arc's full extent by sampling.
  const pts: [number, number][] = [];
  const paths: { d: string; kind: string }[] = [];
  const ticks: string[] = [];
  for (const s of segments) {
    pts.push([s.x0, s.y0], [s.x1, s.y1]);
    if (s.kind === "curve") {
      // sample the arc for bounds
      const r = s.r!;
      const mx = (s.x0 + s.x1) / 2;
      const my = (s.y0 + s.y1) / 2;
      const dx = s.x1 - s.x0;
      const dy = s.y1 - s.y0;
      const chord = Math.hypot(dx, dy);
      const sag = r - Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2));
      // Left-turning arc bulges to the right of the chord.
      pts.push([mx + (dy / chord) * sag, my - (dx / chord) * sag]);
      paths.push({ d: `M${s.x0} ${-s.y0} A${r} ${r} 0 0 0 ${s.x1} ${-s.y1}`, kind: "curve" });
    } else {
      paths.push({ d: `M${s.x0} ${-s.y0} L${s.x1} ${-s.y1}`, kind: "straight" });
    }
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, -y); maxY = Math.max(maxY, -y);
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const stroke = span * 0.035;
  const pad = stroke * 2;
  // Joint ticks across the track at every piece start.
  for (const s of segments) {
    let hx: number, hy: number;
    if (s.kind === "straight") {
      hx = s.x1 - s.x0; hy = s.y1 - s.y0;
    } else {
      // tangent at start of a left arc: perpendicular to radius
      const r = s.r!;
      const a0 = Math.atan2(s.y1 - s.y0, s.x1 - s.x0) - ((s.arc! * Math.PI) / 180) / 2;
      hx = Math.cos(a0) * r; hy = Math.sin(a0) * r;
    }
    const l = Math.hypot(hx, hy) || 1;
    const nx = (-hy / l) * stroke * 0.9;
    const ny = (hx / l) * stroke * 0.9;
    ticks.push(`M${s.x0 + nx} ${-(s.y0 + ny)} L${s.x0 - nx} ${-(s.y0 - ny)}`);
  }
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
  return (
    <svg className="loop-drawing" viewBox={vb} width="100%" style={{ maxHeight: size }} role="img"
      aria-label={`Drawing of the ${plan.shape} with ${plan.total_pieces} pieces`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" strokeLinecap="butt"
          className={p.kind === "curve" ? "loop-drawing__curve" : "loop-drawing__straight"}
          strokeWidth={stroke} />
      ))}
      {ticks.map((d, i) => (
        <path key={`t${i}`} d={d} className="loop-drawing__tick" strokeWidth={stroke * 0.22} />
      ))}
    </svg>
  );
}
