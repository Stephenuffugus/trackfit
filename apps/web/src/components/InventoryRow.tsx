import { getSystem } from "@trackfit/library";
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
 * Qty cell is `[−] [input] [+]` (focus-group P1-T2-F2 + P5-T2-F1). The
 * stepper buttons are 44×44 per WCAG 2.5.5; the text input stays editable
 * for users who want to type a number directly. All three converge on the
 * same `onChange("qty", value)` handler so the undo-toast wiring in
 * useUndoableInventory continues to work without changes.
 *
 * Brand chip (focus-group P2-T2-F3) is shown beside the label only when
 * `row.system_id` is set — i.e. the row was loaded from a preset or picked
 * via the PiecePicker. Hand-typed rows render no chip; we deliberately
 * don't force the user to pick a brand, that's friction.
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

  // Brand chip text — manufacturer name from the library, falls back to a
  // de-slugged version of the system_id when the system isn't registered
  // (defensive: a stale persisted row referencing a removed system still
  // surfaces *something* readable rather than a broken state).
  const brandLabel = (() => {
    if (!row.system_id) return null;
    const sys = getSystem(row.system_id);
    if (sys) return sys.manufacturer;
    return row.system_id
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  })();

  // Stepper math. The qty handler upstream re-parses the string as an
  // int and clamps at 0, so we serialize numbers to strings here. Floor
  // guard: if the persisted qty is somehow non-numeric, treat as 0.
  const currentQty = Number.isFinite(row.qty) ? row.qty : 0;
  const decDisabled = isDecDisabled(currentQty);
  const handleDec = () => {
    if (decDisabled) return;
    onChange(idx, "qty", String(stepQty(currentQty, "dec")));
  };
  const handleInc = () => {
    onChange(idx, "qty", String(stepQty(currentQty, "inc")));
  };

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
        <div className="inv-label-meta">
          {brandLabel ? (
            <span
              className="inv-brand-chip"
              title={`Source: ${brandLabel}`}
              aria-label={`Brand ${brandLabel}`}
            >
              {brandLabel}
            </span>
          ) : null}
          {subscript ? (
            <span className="inv-subscript" title={subscript}>
              {subscript}
            </span>
          ) : null}
        </div>
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
      <div className="inv-qty-cell" data-field="qty">
        <button
          type="button"
          className="qty-stepper"
          aria-label="Decrease quantity"
          aria-disabled={decDisabled || undefined}
          disabled={decDisabled}
          onClick={handleDec}
        >
          −
        </button>
        <input
          type="number"
          step={1}
          min={0}
          inputMode="numeric"
          className="qty-input"
          value={row.qty}
          onChange={(e) => onChange(idx, "qty", e.target.value)}
          aria-label={`Quantity of ${row.label}`}
        />
        <button
          type="button"
          className="qty-stepper"
          aria-label="Increase quantity"
          onClick={handleInc}
        >
          +
        </button>
      </div>
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
 * Pure qty-stepper math. Exported for unit tests so the
 * "increment / decrement / clamp at 0" rule is verifiable without DOM.
 *
 * - `inc`: unbounded — some O-scale collectors own 200+ of one piece type
 *   (focus-group P1-T2-F2 rationale).
 * - `dec`: clamps at 0; never goes negative.
 * - Non-numeric input is coerced to 0 defensively (matches the
 *   InventoryRow's Number.isFinite guard).
 */
export function stepQty(current: number, direction: "inc" | "dec"): number {
  const c = Number.isFinite(current) ? current : 0;
  if (direction === "inc") return c + 1;
  return Math.max(0, c - 1);
}

/**
 * Pure "is the decrement button disabled?" predicate. Mirrors the spec's
 * disabled-at-floor rule — no upper ceiling.
 */
export function isDecDisabled(current: number): boolean {
  const c = Number.isFinite(current) ? current : 0;
  return c <= 0;
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
