import { CURVE_ARC_PRESETS } from "../lib/constants";
import type { GapShape, Unit } from "../lib/types";
import { PhotoButton } from "./PhotoButton";
import { UnitToggle } from "./UnitToggle";

interface Props {
  gapPhoto: string | null;
  target: string;
  tolerance: string;
  unit: Unit;
  /** "straight" | "curve" | "offset" — drives which inputs render. */
  gapShape: GapShape;
  /** raw arc string for curve gaps (degrees). Empty = no preset chosen yet. */
  gapArcDegrees: string;
  /** raw lateral-shift string for offset/S-curve gaps, in user-display units. */
  gapOffset: string;
  /** disable the solve button while a worker is in flight. */
  solving: boolean;
  /**
   * Wall-clock seconds since the current solve started. Drives the
   * "Solving… 3s" counter and the Cancel button (which shows after
   * 2 s). Null when no solve is in flight.
   */
  solveElapsedSec: number | null;
  /** Stop the in-flight solve. The button surfaces after 2 s. */
  onCancel: () => void;
  onPhotoClick: () => void;
  onTargetChange: (v: string) => void;
  onToleranceChange: (v: string) => void;
  onUnitChange: (u: Unit) => void;
  onShapeChange: (s: GapShape) => void;
  onArcChange: (v: string) => void;
  onOffsetChange: (v: string) => void;
  onSolve: () => void;
  /**
   * Open the reference-object measurement overlay. The button below the
   * gap photo dispatches this; it's disabled when there's no gapPhoto to
   * measure against.
   */
  onMeasureClick: () => void;
}

/**
 * The "Gap to fill" card.
 *
 * Three flavors driven by `gapShape`:
 *  - "straight": single length input (v0.2 default).
 *  - "curve":    chord length + arc-sweep picker (90° / 45° / 30° / 22.5° / custom).
 *  - "offset":   chord length + lateral shift in mm (S-curve, net angle 0).
 *
 * Tolerance ("wiggle room") is one knob the user sees. The curve solver
 * accepts per-axis tolerances; the App layer fans this single value out to
 * length and lateral, with a fixed 0.5° default for angle.
 *
 * Hitting Enter in any number field triggers Solve, just like v0.2.
 */
export function GapCard({
  gapPhoto,
  target,
  tolerance,
  unit,
  gapShape,
  gapArcDegrees,
  gapOffset,
  solving,
  solveElapsedSec,
  onCancel,
  onPhotoClick,
  onTargetChange,
  onToleranceChange,
  onUnitChange,
  onShapeChange,
  onArcChange,
  onOffsetChange,
  onSolve,
  onMeasureClick,
}: Props) {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSolve();
  };

  const targetLabel =
    gapShape === "straight" ? "Target length" : "Chord length";

  return (
    <section className="app-section">
      <p className="label">Gap to fill</p>
      <div className="card">
        <div className="gap-photo-area">
          <PhotoButton
            photo={gapPhoto}
            size="lg"
            ariaLabel={
              gapPhoto ? "View gap reference photo" : "Add photo of the gap"
            }
            alt="Gap reference photo"
            onClick={onPhotoClick}
          />
          <div className="gap-photo-text">
            <span className="field-label">Photo of the gap (optional)</span>
            <p className="hint">
              Snap a reference photo so you remember which gap this is. Or tap
              Measure if you have a quarter or dollar bill in the photo.
            </p>
            <button
              type="button"
              className="measure-cta"
              onClick={onMeasureClick}
              disabled={!gapPhoto}
              aria-describedby={gapPhoto ? undefined : "measure-cta-help"}
            >
              Measure with a reference →
            </button>
            {!gapPhoto && (
              <span id="measure-cta-help" className="measure-cta-help">
                Take a photo of the gap with a quarter or dollar bill in
                frame, then tap Measure.
              </span>
            )}
          </div>
        </div>

        {/* Gap shape picker — drives which inputs show below. */}
        <fieldset className="gap-shape">
          <legend className="field-label">Gap shape</legend>
          <ShapeOption
            id="shape-straight"
            value="straight"
            current={gapShape}
            onChange={onShapeChange}
            title="Straight"
            blurb="Length only"
          />
          <ShapeOption
            id="shape-curve"
            value="curve"
            current={gapShape}
            onChange={onShapeChange}
            title="Curved"
            blurb="Length + how much it turns"
          />
          <ShapeOption
            id="shape-offset"
            value="offset"
            current={gapShape}
            onChange={onShapeChange}
            title="Offset / S-curve"
            blurb="Length + how far it shifts sideways"
          />
        </fieldset>

        <div className="target-grid">
          <div className="field">
            <span className="field-label">{targetLabel}</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder={`e.g. 13.5${unit === "mm" ? " or 47cm" : ""}`}
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="off"
              aria-describedby="target-cm-hint"
            />
          </div>
          <div className="field">
            <span className="field-label">
              Wiggle room (±){" "}
              <span
                className="help-icon"
                title="How close is close enough? Default ±2 mm — about a hair's width."
                aria-label="How close is close enough? Default plus or minus 2 mm — about a hair's width."
              >
                ?
              </span>
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={tolerance}
              onChange={(e) => onToleranceChange(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="off"
            />
          </div>
        </div>
        <p id="target-cm-hint" className="hint">
          You can add "cm" to enter centimetres (e.g. "47cm").
        </p>

        {gapShape === "curve" ? (
          <div className="gap-curve-row">
            <span className="field-label">How much does it turn?</span>
            <div className="arc-picker">
              {CURVE_ARC_PRESETS.map((p) => {
                const isActive =
                  parseFloat(gapArcDegrees) === p.degrees && gapArcDegrees !== "";
                return (
                  <button
                    key={p.degrees}
                    type="button"
                    className={`arc-chip${isActive ? " arc-chip--active" : ""}`}
                    onClick={() => onArcChange(String(p.degrees))}
                  >
                    {p.label}
                  </button>
                );
              })}
              <label className="arc-custom">
                <span className="field-label">Custom (°)</span>
                <input
                  type="number"
                  step="any"
                  value={gapArcDegrees}
                  onChange={(e) => onArcChange(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="e.g. 60"
                />
              </label>
            </div>
          </div>
        ) : null}

        {gapShape === "offset" ? (
          <div className="gap-offset-row">
            <div className="field">
              <span className="field-label">
                How far does the gap shift sideways?
              </span>
              <div className="offset-row">
                <input
                  type="number"
                  step="any"
                  value={gapOffset}
                  onChange={(e) => onOffsetChange(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="e.g. 150"
                />
                <SCurveGlyph />
              </div>
            </div>
          </div>
        ) : null}

        <div className="unit-row">
          <span className="field-label">Units</span>
          <UnitToggle unit={unit} onChange={onUnitChange} />
        </div>

        <button
          type="button"
          className={`solve${solving ? " solve--busy" : ""}`}
          onClick={onSolve}
          disabled={solving}
          aria-busy={solving}
        >
          {solving ? (
            <span className="solve-busy-inner">
              <SpinnerGlyph />
              {typeof solveElapsedSec === "number" && solveElapsedSec >= 1
                ? `Solving… ${solveElapsedSec}s`
                : "Solving…"}
            </span>
          ) : (
            "Find combinations →"
          )}
        </button>

        {/* Cancel button surfaces after 2 s of solving. The solver self-
            times-out at 8 s on legitimate-but-hard targets; this button
            is for the user who knows the gap they typed is unreasonable
            and just wants their UI back. */}
        {solving &&
        typeof solveElapsedSec === "number" &&
        solveElapsedSec >= 2 ? (
          <button
            type="button"
            className="btn solve-cancel"
            onClick={onCancel}
            aria-label="Cancel the current solve"
          >
            Cancel solve
          </button>
        ) : null}
      </div>
    </section>
  );
}

interface ShapeOptionProps {
  id: string;
  value: GapShape;
  current: GapShape;
  onChange: (s: GapShape) => void;
  title: string;
  blurb: string;
}

/** One row of the gap-shape picker — radio + label + sub-blurb. */
function ShapeOption({ id, value, current, onChange, title, blurb }: ShapeOptionProps) {
  const checked = value === current;
  return (
    <label
      htmlFor={id}
      className={`gap-shape__opt${checked ? " gap-shape__opt--active" : ""}`}
    >
      <input
        id={id}
        type="radio"
        name="gap-shape"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
      />
      <span className="gap-shape__copy">
        <span className="gap-shape__title">{title}</span>
        <span className="gap-shape__blurb">{blurb}</span>
      </span>
    </label>
  );
}

/** Tiny S-curve diagram next to the lateral-shift input. Pure SVG. */
function SCurveGlyph() {
  return (
    <svg
      className="gap-offset-glyph"
      width="56"
      height="32"
      viewBox="0 0 56 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 24 C 14 24 14 8 28 8 S 42 24 54 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line x1="2" y1="28" x2="54" y2="28" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 2" />
    </svg>
  );
}

/** Rotating tick — matches the IBM Plex Mono / signal-red look. */
function SpinnerGlyph() {
  return (
    <svg
      className="solve-spinner"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path
        d="M7 2 a5 5 0 0 1 5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
