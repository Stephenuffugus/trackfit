import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  recordAnswer,
  type PricingAnswer,
  type PricingFeedbackEntry,
} from "../lib/pricing-feedback";

interface Props {
  open: boolean;
  feature: PricingFeedbackEntry["feature"];
  inventorySize: number;
  onClose: () => void;
}

/** Hard-coded so the bundle stays static at build time. Bump alongside
 *  the footer string in App.tsx whenever the prototype version moves. */
const APP_VERSION = "v0.3";

interface Option {
  answer: PricingAnswer;
  label: string;
}

/**
 * The five options the test exposes. Order is intentional: ascending
 * one-time prices first, then the subscription, then the opt-out at the
 * bottom — putting "Not interested" last makes it less of a default
 * escape hatch for someone skimming.
 */
const OPTIONS: Option[] = [
  { answer: "9_once", label: "I'd pay $9 once for it" },
  { answer: "19_once", label: "I'd pay $19 once for it" },
  { answer: "29_once", label: "I'd pay $29 once for it" },
  { answer: "5_per_month", label: "$5/month feels fair" },
  { answer: "not_interested", label: "Not interested at any price" },
];

/**
 * Layer-2 fake-door pricing modal. Opens once per device immediately
 * after the user's first successful photo-ID auto-fill; never reopens
 * for that feature once an answer is recorded. Closing without
 * answering is allowed but does NOT mark the feature answered, so
 * skippers see the modal again next session — Stephen specifically
 * wants reaction signal, not pestering, so we accept that mild trade.
 *
 * Visual constraints (handoff §9 — design changes are permission-gated):
 *   - Reuses .modal / .modal-inner, .btn, .field-label, .undo-toast.
 *   - No new colors, fonts, or component classes.
 *   - 44px minimum touch targets on every action button (older audience).
 */
export function PremiumPricingTest({
  open,
  feature,
  inventorySize,
  onClose,
}: Props) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [thanksToast, setThanksToast] = useState(false);

  // Reset local state every time the modal opens so a previously-typed
  // (then-cancelled) comment doesn't leak into a future open.
  useEffect(() => {
    if (open) {
      setComment("");
      setSubmitting(false);
      setThanksToast(false);
    }
  }, [open]);

  // Auto-dismiss the "thanks" toast after a short beat — same ~3s feel
  // as the rest of the app's transient affordances. We don't reuse the
  // UndoToast component itself (it has an Undo action; this toast has
  // no action) but we DO reuse its CSS classes so the visual language
  // stays identical.
  useEffect(() => {
    if (!thanksToast) return;
    const t = window.setTimeout(() => setThanksToast(false), 3000);
    return () => window.clearTimeout(t);
  }, [thanksToast]);

  const trapRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    onEscape: onClose,
    // Land on the dialog itself rather than the first $9 button —
    // accidental Enter on modal-open shouldn't silently submit the
    // cheapest answer for an older user still reading the title.
    initialFocus: "container",
  });

  const handleAnswer = async (answer: PricingAnswer) => {
    if (submitting) return;
    setSubmitting(true);
    const entry: PricingFeedbackEntry = {
      answer,
      feature,
      answered_at: new Date().toISOString(),
      app_version: APP_VERSION,
      inventory_size: inventorySize,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    };
    // recordAnswer swallows its own errors; we don't await long-running
    // network work before closing because the user expects the modal to
    // dismiss immediately on tap. The localStorage write is synchronous
    // and finishes before the await yields.
    await recordAnswer(entry);
    setThanksToast(true);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        ref={trapRef}
        className="modal open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-test-title"
        onClick={(e) => {
          // Backdrop click dismisses without recording — same as ESC.
          // The user is explicitly opting out of the question.
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="modal-inner">
          <h2 id="pricing-test-title" style={{ margin: "0 0 6px" }}>
            Photo-ID is a Trackfit Premium feature.
          </h2>
          <p
            className="field-label"
            style={{ margin: "0 0 14px", textTransform: "none" }}
          >
            We're testing pricing. Tell us what feels fair.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {OPTIONS.map((opt) => (
              <button
                key={opt.answer}
                type="button"
                className="btn"
                disabled={submitting}
                onClick={() => handleAnswer(opt.answer)}
                style={{ justifyContent: "flex-start", textAlign: "left" }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label
            className="field-label"
            style={{ display: "block", marginBottom: 6 }}
            htmlFor="pricing-comment"
          >
            Anything else? (optional)
          </label>
          <textarea
            id="pricing-comment"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
            style={{
              width: "100%",
              fontFamily: "inherit",
              fontSize: 14,
              padding: 8,
              border: "1.5px solid var(--ink)",
              background: "var(--bg)",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {thanksToast
        ? createPortal(
            <div
              className="undo-toast"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="undo-toast__msg">
                Thanks — your feedback helps us decide what to build next.
              </span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
