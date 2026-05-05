import type { InventoryRow as Row, Unit } from "../lib/types";
import { InventoryRow } from "./InventoryRow";

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
}

/** Inventory section: header row + rows + "+ Add piece" + "Reset" action. */
export function InventoryList({
  rows,
  unit,
  onPhotoClick,
  onChange,
  onDelete,
  onAdd,
  onReset,
}: Props) {
  return (
    <section className="app-section">
      <div className="label-row">
        <p className="label">Your inventory</p>
        <button
          type="button"
          className="text-action"
          title="Clear all pieces and reload the default preset"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
      <div className="card">
        <div className="inv-row inv-head">
          <div>Photo</div>
          <div>Piece label</div>
          <div>Length</div>
          <div>Qty</div>
          <div />
        </div>
        {rows.map((row, idx) => (
          <InventoryRow
            key={idx}
            idx={idx}
            row={row}
            unit={unit}
            onPhotoClick={onPhotoClick}
            onChange={onChange}
            onDelete={onDelete}
          />
        ))}
        <button type="button" className="add-row" onClick={onAdd}>
          + Add piece
        </button>
      </div>
    </section>
  );
}
