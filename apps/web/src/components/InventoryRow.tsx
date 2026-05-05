import { formatLength } from "../lib/format";
import type { InventoryRow as Row, Unit } from "../lib/types";
import { PhotoButton } from "./PhotoButton";

interface Props {
  idx: number;
  row: Row;
  unit: Unit;
  onPhotoClick: (idx: number) => void;
  onChange: (idx: number, field: "label" | "length" | "qty", value: string) => void;
  onDelete: (idx: number) => void;
}

/**
 * Single inventory row: photo / label / length / qty / delete.
 *
 * Mobile (<520px) re-stacks via grid-template-areas — see the @media block
 * in src/styles/index.css. The `data-field` and `data-action` attributes
 * are what the mobile layout pins each child to.
 */
export function InventoryRow({
  idx,
  row,
  unit,
  onPhotoClick,
  onChange,
  onDelete,
}: Props) {
  return (
    <div className="inv-row">
      <PhotoButton
        photo={row.photo}
        size="sm"
        alt={row.label}
        ariaLabel={
          row.photo
            ? `View photo for ${row.label}`
            : `Add photo for ${row.label}`
        }
        onClick={() => onPhotoClick(idx)}
      />
      <input
        type="text"
        value={row.label}
        data-field="label"
        onChange={(e) => onChange(idx, "label", e.target.value)}
      />
      <input
        type="number"
        step="any"
        inputMode="decimal"
        value={formatLength(row.length_mm, unit)}
        data-field="length"
        onChange={(e) => onChange(idx, "length", e.target.value)}
      />
      <input
        type="number"
        step={1}
        min={0}
        inputMode="numeric"
        value={row.qty}
        data-field="qty"
        onChange={(e) => onChange(idx, "qty", e.target.value)}
      />
      <button
        type="button"
        className="icon-btn"
        data-action="delete"
        title="Remove"
        aria-label="Remove row"
        onClick={() => onDelete(idx)}
      >
        ×
      </button>
    </div>
  );
}
