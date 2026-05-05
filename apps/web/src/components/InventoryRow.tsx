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
 * Curves, turnouts, and crossings are rendered with a small subscript that
 * exposes the catalog-derived geometry the user can't edit (radius / arc,
 * frog number, "crossing"). The length column for those kinds is read-only
 * and gets a lock glyph next to it — that arc length is computed from
 * radius × arc, not user input. Straights and fitters keep the v0.2 layout.
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
  const kind = row.kind;
  const isCurve = kind === "curve";
  const isTurnout = kind === "turnout";
  const isCrossing = kind === "crossing";
  const isReadOnlyLength = isCurve || isTurnout || isCrossing;

  // Plain-English subscript line. We avoid CAD jargon — "r457mm · 30°" reads
  // like the spec on the box, "frog #4" matches Atlas's own catalog.
  let subscript: string | null = null;
  if (isCurve && row.radius_mm && row.arc_degrees) {
    const r = Math.round(row.radius_mm);
    const a = row.arc_degrees;
    subscript = `r${r}mm · ${a}°`;
  } else if (isTurnout) {
    subscript =
      typeof row.turnout_frog === "string" && row.turnout_frog
        ? row.turnout_frog
        : "turnout";
  } else if (isCrossing) {
    subscript = "crossing";
  }

  // Curves report arc length with a "~" prefix because it's derived. The user
  // didn't type 239 mm into anything; that's r·θ from the catalog page.
  const lengthDisplay = formatLength(row.length_mm, unit);
  const lengthValue = isReadOnlyLength ? `~${lengthDisplay}` : lengthDisplay;

  return (
    <div className="inv-row" data-kind={kind ?? "unknown"}>
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
      <div className="inv-label-cell" data-field="label">
        <input
          type="text"
          value={row.label}
          onChange={(e) => onChange(idx, "label", e.target.value)}
        />
        {subscript ? (
          <span className="inv-subscript" title={subscript}>
            {subscript}
          </span>
        ) : null}
      </div>
      <div className="inv-length-cell" data-field="length">
        {isReadOnlyLength ? (
          <span
            className="inv-length-readonly"
            title="Catalog-derived: this length comes from the manufacturer's spec, not user input."
            aria-label={`${row.label} length ${lengthDisplay} (locked)`}
          >
            <LockGlyph />
            <span className="inv-length-readonly__value">{lengthValue}</span>
          </span>
        ) : (
          <input
            type="number"
            step="any"
            inputMode="decimal"
            value={lengthDisplay}
            onChange={(e) => onChange(idx, "length", e.target.value)}
          />
        )}
      </div>
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

/**
 * Inline SVG padlock — keeps the design system's "no icon library" rule. 12x12
 * matches the IBM Plex Mono cap-height for a 14px input baseline.
 */
function LockGlyph() {
  return (
    <svg
      className="inv-lock"
      width="11"
      height="13"
      viewBox="0 0 11 13"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="6" width="9" height="6.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3 6 V4 a2.5 2.5 0 0 1 5 0 V6" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
