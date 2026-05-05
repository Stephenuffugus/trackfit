import { useCallback, useEffect, useMemo, useState } from "react";
import { pixelDistance, type Point, type ReferenceObject } from "@trackfit/measure";
import { MeasureCanvas, defaultEndpointsFor } from "./MeasureCanvas";
import { MeasureToolbar } from "./MeasureToolbar";
import { ReviewPanel } from "./ReviewPanel";
import {
  back,
  chooseReference,
  confirmGapEndpoints,
  confirmReferenceEndpoints,
  initialPhase,
  isPairComplete,
  setEndpoint,
  type Phase,
} from "./state-machine";

interface Props {
  open: boolean;
  /** The gapPhoto data URL from App state. Required for measurement. */
  photoSrc: string | null;
  /** Called with the computed gap_mm when the user confirms. */
  onMeasured: (gap_mm: number) => void;
  /** Cancel: closes overlay without changes. */
  onClose: () => void;
}

/**
 * Modal overlay that walks the user through the four-step
 * reference-object measurement flow. The state machine itself lives in
 * `./state-machine.ts` so it can be unit-tested without React; this
 * component is the thin UI shell.
 *
 * The overlay handles:
 *   - photo natural-size discovery (so we can pre-fill default endpoints
 *     in photo-pixel coordinates)
 *   - dispatching state-machine transitions on user actions
 *   - escape-to-cancel and locking the page scroll while open
 *   - emitting the final gap_mm back to App.tsx via `onMeasured`
 */
export function GapMeasureOverlay({
  open,
  photoSrc,
  onMeasured,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase());
  const [photoDims, setPhotoDims] = useState<{ w: number; h: number } | null>(
    null,
  );

  // Reset state every time the overlay opens. Otherwise the user would
  // re-enter mid-flow on a second invocation, with stale endpoints from
  // a previous photo possibly off-canvas.
  useEffect(() => {
    if (open) {
      setPhase(initialPhase());
    }
  }, [open]);

  // Lock body scroll while open — the overlay handles its own scroll
  // region. Without this, iOS Safari's rubber-band drags both the
  // overlay and the page underneath.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape to cancel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Decode the photo to learn its natural dimensions. We need them so
  // default-endpoint placement lands inside the visible photo regardless
  // of phone orientation / aspect ratio.
  useEffect(() => {
    if (!photoSrc) {
      setPhotoDims(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setPhotoDims({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = photoSrc;
    return () => {
      cancelled = true;
    };
  }, [photoSrc]);

  /* ----- Action handlers ----- */

  const handlePickReference = useCallback(
    (ref: ReferenceObject) => {
      // Pre-fill endpoints with sensible defaults so the user has
      // something to drag rather than tap-to-place ceremony.
      const next = chooseReference(phase, ref);
      if (next.kind === "place-reference-endpoints" && photoDims) {
        const [a, b] = defaultEndpointsFor(photoDims.w, photoDims.h);
        setPhase({ ...next, endpoints: [a, b] });
      } else {
        setPhase(next);
      }
    },
    [phase, photoDims],
  );

  const handleMoveEndpoint = useCallback(
    (index: 0 | 1, point: Point) => {
      setPhase((p) => setEndpoint(p, index, point));
    },
    [],
  );

  const handleNext = useCallback(() => {
    setPhase((p) => {
      if (p.kind === "place-reference-endpoints") {
        const next = confirmReferenceEndpoints(p);
        // When we transition into gap placement, pre-fill the gap
        // endpoints just like we did for the reference.
        if (next.kind === "place-gap-endpoints" && photoDims) {
          const [a, b] = defaultEndpointsFor(photoDims.w, photoDims.h);
          return { ...next, endpoints: [a, b] };
        }
        return next;
      }
      if (p.kind === "place-gap-endpoints") {
        return confirmGapEndpoints(p);
      }
      return p;
    });
  }, [photoDims]);

  const handleConfirm = useCallback(() => {
    if (phase.kind !== "review") return;
    onMeasured(phase.result.gap_mm);
  }, [phase, onMeasured]);

  const handleBack = useCallback(() => {
    setPhase((p) => back(p) ?? p);
  }, []);

  /* ----- Derived render values ----- */

  const editing: "ref" | "gap" | null =
    phase.kind === "place-reference-endpoints"
      ? "ref"
      : phase.kind === "place-gap-endpoints"
        ? "gap"
        : null;

  const refEndpointsForCanvas =
    phase.kind === "place-reference-endpoints"
      ? phase.endpoints
      : phase.kind === "place-gap-endpoints" || phase.kind === "review"
        ? phase.refEndpoints
        : null;

  const gapEndpointsForCanvas =
    phase.kind === "place-gap-endpoints"
      ? phase.endpoints
      : phase.kind === "review"
        ? phase.gapEndpoints
        : null;

  const livePx = useMemo(() => {
    if (phase.kind === "place-reference-endpoints") {
      const [a, b] = phase.endpoints;
      if (a && b) return pixelDistance(a, b);
    }
    if (phase.kind === "place-gap-endpoints") {
      const [a, b] = phase.endpoints;
      if (a && b) return pixelDistance(a, b);
    }
    return undefined;
  }, [phase]);

  const instruction = (() => {
    switch (phase.kind) {
      case "pick-reference":
        return "Pick the object you put in the photo. We'll use its known size to figure out the gap.";
      case "place-reference-endpoints":
        return `Tap and drag the two markers to the ends of your ${phase.reference.label} (${phase.reference.dimension_label}).`;
      case "place-gap-endpoints":
        return "Now drag the two markers to the two edges of the gap.";
      case "review":
        return "Here's what we got. Looks right?";
    }
  })();

  if (!open) return null;

  // Defensive: if the overlay was opened without a photo, render a
  // minimal "needs a photo" view rather than a broken canvas. The
  // GapCard button is supposed to prevent this, but belt-and-suspenders.
  if (!photoSrc) {
    return (
      <div
        className="modal open measure-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Measure gap with reference object"
      >
        <div className="modal-inner measure-overlay__inner">
          <p className="measure-overlay__no-photo">
            You'll need a photo of the gap (with a quarter or dollar bill in
            frame) before you can measure.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nextDisabled =
    (phase.kind === "place-reference-endpoints" ||
      phase.kind === "place-gap-endpoints") &&
    !isPairComplete(phase);

  return (
    <div
      className="modal open measure-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Measure gap with reference object"
    >
      <div className="modal-inner measure-overlay__inner">
        <MeasureToolbar
          phase={phase}
          instruction={instruction}
          onPickReference={handlePickReference}
          onBack={handleBack}
          onNext={handleNext}
          onCancel={onClose}
          nextDisabled={nextDisabled}
          {...(livePx !== undefined ? { livePx } : {})}
        />

        {phase.kind !== "review" ? (
          <MeasureCanvas
            photoSrc={photoSrc}
            refEndpoints={refEndpointsForCanvas}
            gapEndpoints={gapEndpointsForCanvas}
            editing={editing}
            onMoveEndpoint={handleMoveEndpoint}
          />
        ) : (
          <ReviewPanel
            reference={phase.reference}
            result={phase.result}
            onConfirm={handleConfirm}
            onBack={handleBack}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}
