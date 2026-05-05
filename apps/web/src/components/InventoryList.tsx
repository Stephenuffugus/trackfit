import { useMemo, useState } from "react";
import type { InventoryRow as Row, Unit } from "../lib/types";
import { InventoryRow } from "./InventoryRow";
import {
  bucketOf,
  InventoryFilters,
  type InventoryFilter,
} from "./InventoryFilters";

interface Props {
  rows: Row[];
  unit: Unit;
  onPhotoClick: (idx: number) => void;
  onChange: (
    idx: number,
    field: "label" | "length" | "qty",
    value: string,
  ) => void;
  onDelete: (idx: number) => void;
  onAdd: () => void;
  onReset: () => void;
  onShowIntro: () => void;
}

/** Inventory section: header row + filter chips + rows + "+ Add piece" + text actions. */
export function InventoryList({
  rows,
  unit,
  onPhotoClick,
  onChange,
  onDelete,
  onAdd,
  onReset,
  onShowIntro,
}: Props) {
  const [filter, setFilter] = useState<InventoryFilter>("all");

  // Pre-compute bucket counts so the filter chips can show "Curves 6" etc.
  const counts = useMemo(() => {
    const c: Record<InventoryFilter, number> = {
      all: rows.length,
      straight: 0,
      curve: 0,
      turnout: 0,
      crossing: 0,
    };
    for (const r of rows) c[bucketOf(r.kind)]++;
    return c;
  }, [rows]);

  // The trick to mutating-by-original-index while showing a filtered view:
  // tag every visible row with its original index *before* filtering. The
  // child components dispatch onChange/onDelete/onPhotoClick using that
  // original index so the underlying state ops stay correct.
  const visible = useMemo(() => {
    return rows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => filter === "all" || bucketOf(row.kind) === filter);
  }, [rows, filter]);

  return (
    <section className="app-section">
      <div className="label-row">
        <p className="label">What's in your box</p>
        <div className="text-actions">
          <button
            type="button"
            className="text-action"
            title="Replay the welcome cards"
            onClick={onShowIntro}
          >
            Show intro again
          </button>
          <button
            type="button"
            className="text-action"
            title="Clear your inventory and gap fields"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>
      <p className="section-subhead">
        What you have to work with. Tap a brand to load the standard pieces.
      </p>
      <InventoryFilters active={filter} counts={counts} onChange={setFilter} />
      <div className="card">
        <div className="inv-row inv-head">
          <div>Photo</div>
          <div>Piece label</div>
          <div>Length</div>
          <div>Qty</div>
          <div />
        </div>
        {visible.length === 0 ? (
          <div className="inv-empty-filter">
            No {filter === "all" ? "pieces" : filter + "s"} in your box yet.
          </div>
        ) : (
          visible.map(({ row, idx }) => (
            <InventoryRow
              key={idx}
              idx={idx}
              row={row}
              unit={unit}
              onPhotoClick={onPhotoClick}
              onChange={onChange}
              onDelete={onDelete}
            />
          ))
        )}
        <button type="button" className="add-row" onClick={onAdd}>
          + Add piece
        </button>
      </div>
    </section>
  );
}
