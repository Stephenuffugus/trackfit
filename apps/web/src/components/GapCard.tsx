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
                Coming soon: place a known-length object in frame to
                auto-measure.
              </em>
            </p>
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
