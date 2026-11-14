import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** Toast id — when this changes, the countdown resets. */
  toastId: number;
  message: string;
  /** Seconds to live before the toast auto-dismisses. */
  durationSec?: number;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * Bottom-right transient toast offering an Undo action. Renders into
 * a portal so parent overflow:hidden can't clip it. Counts down a
 * visible (5,4,3,2,1) timer and auto-dismisses at zero.
 *
 * Style: signal-red border, IBM Plex Mono "UNDO" link.
 */
export function UndoToast({
  toastId,
  message,
  durationSec = 5,
  onUndo,
  onDismiss,
}: Props) {
  const [remaining, setRemaining] = useState(durationSec);

  // Reset whenever the toast id flips (new destructive action).
  useEffect(() => {
    setRemaining(durationSec);
  }, [toastId, durationSec]);

  // Get out of the way: once you scroll on (more than a thumb's swipe), the
  // toast goes, so it never sits over what you are reading.
  useEffect(() => {
    const start = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - start) > 120) onDismiss();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [toastId, onDismiss]);

  // 1Hz countdown.
  useEffect(() => {
    if (remaining <= 0) {
      onDismiss();
      return;
    }
    const t = window.setTimeout(() => {
      setRemaining((r) => r - 1);
    }, 1000);
    return () => window.clearTimeout(t);
  }, [remaining, onDismiss]);

  return createPortal(
    <div
      className="undo-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="undo-toast__msg">{message}</span>
      <button
        type="button"
        className="undo-toast__action"
        onClick={onUndo}
      >
        Undo ({remaining})
      </button>
    </div>,
    document.body,
  );
}
