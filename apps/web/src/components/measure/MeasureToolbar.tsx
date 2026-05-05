import { STANDARD_REFERENCES, type ReferenceObject } from "@trackfit/measure";
import type { Phase } from "./state-machine";

interface Props {
  phase: Phase;
  /** Plain-English instruction shown under the step indicator. */
  instruction: string;
  /** Step 1 picker callback. */
  onPickReference: (ref: ReferenceObject) => void;
  /** Back / Next / Confirm / Cancel buttons. */
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  /**
   * Disable Next when the current step's prerequisites aren't met (e.g.
   * step 2 with both reference endpoints not placed). The parent owns
   * this logic via `isPairComplete`.
   */
  nextDisabled: boolean;
  /**
   * Live pixel distance for the pair the user is currently placing,
   * shown next to the instruction so confidence builds as they drag.
   */
  livePx?: number;
}

const STEP_LABELS = [
  "Pick reference",
  "Mark reference",
  "Mark gap",
  "Review",
] as const;

function stepIndex(phase: Phase): 0 | 1 | 2 | 3 {
  switch (phase.kind) {
    case "pick-reference":
      return 0;
    case "place-reference-endpoints":
      return 1;
    case "place-gap-endpoints":
      return 2;
    case "review":
      return 3;
  }
}

/**
 * Top toolbar of the GapMeasureOverlay: step indicator, reference picker
 * (only shown in step 1), live-pixel readout, and the nav buttons. Lives
 * above the photo so the user can read it without lifting a thumb.
 */
export function MeasureToolbar({
  phase,
  instruction,
  onPickReference,
  onBack,
  onNext,
  onCancel,
  nextDisabled,
  livePx,
}: Props) {
  const idx = stepIndex(phase);
  const nextLabel =
    phase.kind === "place-gap-endpoints"
      ? "Looks right →"
      : phase.kind === "review"
        ? "Use this number →"
        : "Next →";
  const showNext = phase.kind !== "pick-reference";

  return (
    <div className="measure-toolbar">
      <div className="measure-toolbar__steps" role="list">
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            role="listitem"
            className={[
              "measure-step",
              i === idx ? "measure-step--active" : "",
              i < idx ? "measure-step--done" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="measure-step__num">{i + 1}</span>
            <span className="measure-step__label">{label}</span>
          </span>
        ))}
      </div>

      <p className="measure-toolbar__instruction">
        {instruction}
        {livePx !== undefined && livePx > 0 && (
          <span className="measure-toolbar__live"> · {Math.round(livePx)} px</span>
        )}
      </p>

      {phase.kind === "pick-reference" && (
        <div className="measure-toolbar__picker">
          {STANDARD_REFERENCES.map((ref) => (
            <button
              key={ref.id}
              type="button"
              className="btn measure-ref-btn"
              onClick={() => onPickReference(ref)}
            >
              <span className="measure-ref-btn__label">{ref.label}</span>
              <span className="measure-ref-btn__dim">
                {ref.dimension_label} · {ref.dimension_mm} mm
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="measure-toolbar__nav">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        {phase.kind !== "pick-reference" && (
          <button type="button" className="btn" onClick={onBack}>
            ← Back
          </button>
        )}
        {showNext && (
          <button
            type="button"
            className="btn measure-toolbar__primary"
            onClick={onNext}
            disabled={nextDisabled}
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
