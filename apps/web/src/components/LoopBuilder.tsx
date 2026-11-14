import { useEffect, useMemo, useState } from "react";
import {
  findLoops,
  leftoverPieces,
  tracePlan,
  type LoopPiece,
  type LoopPlan,
  type LoopResult,
  type LoopUse,
} from "@trackfit/solver";
import { listSystems } from "@trackfit/library";
import type { InventoryRow, Unit } from "../lib/types";
import { formatLength, parseLengthExpression } from "../lib/format";
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

const len = (mm: number, unit: Unit) => `${formatLength(mm, unit)}${unit === "in" ? '"' : " mm"}`;

/** Inventory rows → loop pieces. Flex counts as straight track here. */
function toPieces(inventory: InventoryRow[]): LoopPiece[] {
  const out: LoopPiece[] = [];
  for (const r of inventory) {
    const k = r.kind;
    if (k === "curve") {
      out.push({ label: r.label, kind: "curve", length_mm: r.length_mm, radius_mm: r.radius_mm, arc_degrees: r.arc_degrees, qty: r.qty, system_id: r.system_id });
    } else if (k === "crossing") {
      const l = r.overall_length_mm ?? r.length_mm;
      out.push({ label: r.label, kind: "crossing", length_mm: typeof l === "number" ? l : 0, qty: r.qty, system_id: r.system_id });
    } else if (k === undefined || k === "straight" || k === "fitter" || k === "rerailer" || k === "uncoupler" || k === "flex") {
      if (r.length_mm > 0) out.push({ label: r.label, kind: "straight", length_mm: r.length_mm, qty: r.qty, system_id: r.system_id });
    }
  }
  return out;
}

/** "What else": the best second loop from what one plan leaves over. */
function secondLoop(plan: LoopPlan): LoopPlan | null {
  // A smaller search budget keeps this well under a second.
  const r = findLoops(leftoverPieces(plan), { maxStates: 8000 });
  return r.plans[0] ?? null;
}

/**
 * "What can I build?" Uses only what the user owns, one track system and
 * one rail material at a time, and shows each answer as a drawing, the
 * table space, the parts, the order to lay them, and what is left over.
 */
export function LoopBuilder({ inventory, unit }: Props) {
  const [tableW, setTableW] = useState("");
  const [tableD, setTableD] = useState("");
  const [result, setResult] = useState<LoopResult | null>(null);
  const [printing, setPrinting] = useState<number | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setResult(null);
  }, [inventory]);

  const systemNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of listSystems()) m.set(s.id, s.name);
    return m;
  }, []);

  const run = () => {
    const w = parseLengthExpression(tableW, unit);
    const d = parseLengthExpression(tableD, unit);
    // Leave a little room past the track centre on every side.
    const margin = 2 * 40;
    const pieces = toPieces(inventory);
    setWorking(true);
    window.setTimeout(() => {
      setResult(
        findLoops(pieces, {
          maxWidthMm: w && w.mm > 0 ? w.mm - margin : undefined,
          maxDepthMm: d && d.mm > 0 ? d.mm - margin : undefined,
        }),
      );
      setWorking(false);
    }, 30);
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
          Find complete loops you can build today with only the pieces in your
          box: circles, ovals, rounded rectangles, and figure eights if you have
          a crossing. The one that uses the most of your track comes first.
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
        <button type="button" className="solve loop-builder__go" onClick={run} disabled={empty || working}>
          {working ? "Working…" : "Show loops I can build →"}
        </button>
        {empty ? <p className="loop-builder__hint">Add your track above first.</p> : null}
      </div>

      {result ? (
        result.plans.length === 0 ? (
          <div className="card loop-builder__none" role="status">
            <p className="loop-builder__none-title">No complete loop yet.</p>
            {result.reason ? <p>{result.reason}</p> : null}
            {result.nearest ? <p>{result.nearest}</p> : null}
          </div>
        ) : (
          <>
            {result.figureEightNote ? (
              <p className="loop-builder__note" role="note">
                <strong>No figure eight:</strong> {result.figureEightNote}
              </p>
            ) : null}
            <ol className="loop-list" aria-label="Loops you can build">
              {result.plans.map((plan, i) => (
                <LoopCard
                  key={i}
                  plan={plan}
                  unit={unit}
                  systemName={plan.system_id ? systemNames.get(plan.system_id) : undefined}
                  printing={printing === i}
                  onPrint={() => printPlan(i)}
                  withSecond={i === 0}
                />
              ))}
            </ol>
          </>
        )
      ) : null}
    </section>
  );
}

function planTitle(plan: LoopPlan, unit: Unit): string {
  const curves = `${len(plan.radius_mm, unit)} radius curves`;
  switch (plan.shape) {
    case "circle":
      return `Circle of ${curves}`;
    case "oval":
      return `Oval: ${len(plan.side_mm, unit)} sides, ${curves}`;
    case "rectangle":
      return `Rounded rectangle: ${len(plan.side_mm, unit)} × ${len(plan.side2_mm ?? 0, unit)} sides, ${curves}`;
    case "figure-eight":
      return `Figure eight, ${curves}`;
  }
}

function LoopCard({
  plan,
  unit,
  systemName,
  printing,
  onPrint,
  withSecond,
}: {
  plan: LoopPlan;
  unit: Unit;
  systemName?: string;
  printing: boolean;
  onPrint: () => void;
  withSecond: boolean;
}) {
  const [second, setSecond] = useState<LoopPlan | null | undefined>(undefined);
  return (
    <li className={`card loop-card${printing ? " print-me" : ""}${plan.uses_most ? " loop-card--most" : ""}`}>
      {plan.uses_most ? (
        <p className="loop-card__badge">Uses the most of your box</p>
      ) : null}
      <h3 className="loop-card__title">{planTitle(plan, unit)}</h3>
      <p className="loop-card__size">
        Needs about <strong>{roomSize(plan.width_mm + 80, unit)} × {roomSize(plan.depth_mm + 80, unit)}</strong>
        {" "}of table. {plan.total_pieces} pieces, {roomSize(plan.run_mm, unit)} of track
        {systemName ? `, ${systemName}` : ""}
        {plan.material ? `, ${plan.material} rail` : ""}.
      </p>
      <LoopDrawing plan={plan} />
      <p className="loop-card__legend">
        <span className="swatch swatch--straight" /> straight
        <span className="swatch swatch--curve" /> curve
        {plan.shape === "figure-eight" ? (
          <>
            <span className="swatch swatch--crossing" /> crossing
          </>
        ) : null}
        <span className="muted"> · ticks show where pieces join</span>
      </p>
      <PartsTable caption="Pieces to take out of the box" rows={plan.parts} />
      <RunningOrder plan={plan} />
      {plan.leftovers.length ? (
        <PartsTable caption="Left in the box afterwards" rows={plan.leftovers} muted />
      ) : (
        <p className="loop-card__how">This uses every straight and curve you own of this kind.</p>
      )}
      {withSecond && plan.leftovers.length ? (
        second === undefined ? (
          <button type="button" className="btn loop-card__second" onClick={() => setSecond(secondLoop(plan))}>
            What else could I build with what is left?
          </button>
        ) : second ? (
          <div className="loop-card__also">
            <p className="loop-card__order-title">You could also build this at the same time</p>
            <p className="loop-card__size">
              {planTitle(second, unit)}. Needs about {roomSize(second.width_mm + 80, unit)} × {roomSize(second.depth_mm + 80, unit)} of its own.
            </p>
            <LoopDrawing plan={second} size={200} />
            <PartsTable caption="Its pieces (from what is left)" rows={second.parts} />
          </div>
        ) : (
          <p className="loop-card__how">The pieces left over do not make a second complete loop.</p>
        )
      ) : null}
      <button type="button" className="btn loop-card__print" onClick={onPrint}>
        Print this plan
      </button>
    </li>
  );
}

function PartsTable({ caption, rows, muted }: { caption: string; rows: LoopUse[]; muted?: boolean }) {
  return (
    <table className={`loop-card__parts${muted ? " loop-card__parts--muted" : ""}`}>
      <caption>{caption}</caption>
      <tbody>
        {rows.map((p, k) => (
          <tr key={k}>
            <td className="loop-card__count">{p.count} ×</td>
            <td>{p.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Group a run of pieces: "4 × S248, 1 × S62". */
function runText(run: LoopUse[]): string {
  const parts: { label: string; n: number }[] = [];
  for (const p of run) {
    const last = parts[parts.length - 1];
    if (last && last.label === p.label) last.n++;
    else parts.push({ label: p.label, n: 1 });
  }
  return parts.map((x) => `${x.n} × ${x.label}`).join(", ");
}

function RunningOrder({ plan }: { plan: LoopPlan }) {
  return (
    <div className="loop-card__order">
      <p className="loop-card__order-title">Lay them in this order</p>
      <ol>
        {plan.legs.map((l, k) => {
          const run = plan.sequence.slice(l.from, l.to);
          return (
            <li key={k}>
              <strong>{l.name}:</strong>{" "}
              {run[0]?.repeat ? "the same crossing piece, along its other track" : runText(run)}
            </li>
          );
        })}
      </ol>
      <p className="loop-card__how">
        {plan.shape === "figure-eight"
          ? "The second loop bends the other way: lay those curves turned round. The last piece meets the first."
          : "All curves turn the same way. The last piece meets the first."}
      </p>
    </div>
  );
}

export function LoopDrawing({ plan, size = 320 }: { plan: LoopPlan; size?: number }) {
  const { segments } = tracePlan(plan);
  const pts: [number, number][] = [];
  const paths: { d: string; kind: string }[] = [];
  const ticks: string[] = [];
  for (const s of segments) {
    pts.push([s.x0, s.y0], [s.x1, s.y1]);
    if (s.kind === "curve") {
      const r = s.r!;
      const t = s.turn ?? 1;
      const mx = (s.x0 + s.x1) / 2;
      const my = (s.y0 + s.y1) / 2;
      const dx = s.x1 - s.x0;
      const dy = s.y1 - s.y0;
      const chord = Math.hypot(dx, dy) || 1;
      const sag = r - Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2));
      // A left turn bulges to the right of its chord, a right turn to the left.
      pts.push([mx + t * (dy / chord) * sag, my - t * (dx / chord) * sag]);
      paths.push({ d: `M${s.x0} ${-s.y0} A${r} ${r} 0 0 ${t === 1 ? 0 : 1} ${s.x1} ${-s.y1}`, kind: "curve" });
    } else if (!s.repeat) {
      paths.push({ d: `M${s.x0} ${-s.y0} L${s.x1} ${-s.y1}`, kind: s.kind });
    } else {
      paths.push({ d: `M${s.x0} ${-s.y0} L${s.x1} ${-s.y1}`, kind: "crossing" });
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
  for (const s of segments) {
    let hx: number, hy: number;
    if (s.kind !== "curve") {
      hx = s.x1 - s.x0; hy = s.y1 - s.y0;
    } else {
      const t = s.turn ?? 1;
      const a0 = Math.atan2(s.y1 - s.y0, s.x1 - s.x0) - (t * ((s.arc! * Math.PI) / 180)) / 2;
      hx = Math.cos(a0); hy = Math.sin(a0);
    }
    const l = Math.hypot(hx, hy) || 1;
    const nx = (-hy / l) * stroke * 0.9;
    const ny = (hx / l) * stroke * 0.9;
    ticks.push(`M${s.x0 + nx} ${-(s.y0 + ny)} L${s.x0 - nx} ${-(s.y0 - ny)}`);
  }
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
  return (
    <svg className="loop-drawing" viewBox={vb} width="100%" style={{ maxHeight: size }} role="img"
      aria-label={`Drawing of the ${plan.shape.replace("-", " ")} with ${plan.total_pieces} pieces`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" strokeLinecap="butt"
          className={p.kind === "curve" ? "loop-drawing__curve" : p.kind === "crossing" ? "loop-drawing__crossing" : "loop-drawing__straight"}
          strokeWidth={stroke} />
      ))}
      {ticks.map((d, i) => (
        <path key={`t${i}`} d={d} className="loop-drawing__tick" strokeWidth={stroke * 0.22} />
      ))}
    </svg>
  );
}
