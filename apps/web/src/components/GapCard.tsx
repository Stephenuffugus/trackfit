import type { Unit } from "../lib/types";
import { PhotoButton } from "./PhotoButton";
import { UnitToggle } from "./UnitToggle";

interface Props {
  gapPhoto: string | null;
  target: string;
  tolerance: string;
  unit: Unit;
  onPhotoClick: () => void;
  onTargetChange: (v: string) => void;
  onToleranceChange: (v: string) => void;
  onUnitChange: (u: Unit) => void;
  onSolve: () => void;
  /**
   * Open the reference-object measurement overlay. The button below the
   * gap photo dispatches this; it's disabled when there's no gapPhoto to
   * measure against.
   */
  onMeasureClick: () => void;
}

/**
 * The "Gap to fill" card. Photo + target / tolerance fields + unit toggle
 * + the big red Solve button. Hitting Enter inside either number field
 * triggers solve (handled at the input level via onKeyDown).
 */
export function GapCard({
  gapPhoto,
  target,
  tolerance,
  unit,
  onPhotoClick,
  onTargetChange,
  onToleranceChange,
  onUnitChange,
  onSolve,
  onMeasureClick,
}: Props) {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSolve();
  };
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
              Snap a reference photo so you remember which gap this is.{" "}
              <em>
                Snap a photo with a quarter or dollar bill in frame, then tap
                Measure to extract the gap length.
              </em>
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

        <div className="target-grid">
          <div className="field">
            <span className="field-label">Target length</span>
            <input
              type="number"
              step="any"
              placeholder="e.g. 13.5"
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>
          <div className="field">
            <span className="field-label">Tolerance (±)</span>
            <input
              type="number"
              step="any"
              value={tolerance}
              onChange={(e) => onToleranceChange(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>
        </div>

        <div className="unit-row">
          <span className="field-label">Units</span>
          <UnitToggle unit={unit} onChange={onUnitChange} />
        </div>

        <button type="button" className="solve" onClick={onSolve}>
          Find combinations →
        </button>
      </div>
    </section>
  );
}
