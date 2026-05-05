import type { MeasurementResult, ReferenceObject } from "@trackfit/measure";

interface Props {
  reference: ReferenceObject;
  result: MeasurementResult;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
}

/**
 * Step 4 — review the computed measurement before committing it back to
 * the gap target field.
 *
 * Shows the gap_mm in big Fraunces serif (matching the result-total style
 * in the rest of the app), the pixels-per-mm scale derived from the
 * reference (so users with a calibration mindset can sanity-check), and
 * any reliability warning the math layer surfaced.
 */
export function ReviewPanel({
  reference,
  result,
  onConfirm,
  onBack,
  onCancel,
}: Props) {
  const mm = parseFloat(result.gap_mm.toFixed(1));
  const pxPerMm = parseFloat(result.pixels_per_mm.toFixed(2));
  return (
    <div className="measure-review">
      <p className="field-label">Computed gap length</p>
      <div className="measure-review__value">
        <span className="measure-review__num">{mm}</span>
        <span className="measure-review__unit">mm</span>
      </div>

      <dl className="measure-review__stats">
        <div>
          <dt>Reference</dt>
          <dd>
            {reference.label} ({reference.dimension_mm} mm)
          </dd>
        </div>
        <div>
          <dt>Scale</dt>
          <dd>{pxPerMm} px/mm</dd>
        </div>
        <div>
          <dt>Reference span</dt>
          <dd>{Math.round(result.reference_pixel_distance)} px</dd>
        </div>
        <div>
          <dt>Gap span</dt>
          <dd>{Math.round(result.gap_pixel_distance)} px</dd>
        </div>
      </dl>

      {result.warning && (
        <div
          className={`measure-review__warning${result.reliable ? "" : " measure-review__warning--hard"}`}
          role="alert"
        >
          <strong>{result.reliable ? "Heads up:" : "Low confidence:"}</strong>{" "}
          {result.warning}
        </div>
      )}

      <p className="measure-review__prompt">Looks right?</p>

      <div className="measure-review__nav">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={onBack}>
          ← Adjust
        </button>
        <button
          type="button"
          className="btn measure-review__confirm"
          onClick={onConfirm}
        >
          Use {mm} mm →
        </button>
      </div>
    </div>
  );
}
