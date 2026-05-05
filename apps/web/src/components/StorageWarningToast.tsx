import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  hasBeenWarned,
  markWarned,
  STORAGE_WARNING_EVENT,
  type StorageWarningEventDetail,
} from "../lib/storage";

/**
 * Persistent (no auto-dismiss) toast that surfaces a localStorage
 * quota-failure with concrete next-step copy for an older audience.
 *
 * Per [P6-T5-F1] in the focus-group stress test: silent data loss is
 * the cardinal sin. The previous behaviour was a `console.warn` that
 * no real user would ever see; this component makes the failure
 * visible and tells the user exactly what to do.
 *
 * Style: reuses the existing `.undo-toast` surface (signal-red border,
 * IBM Plex copy). No new visual vocabulary. Permission-gated.
 *
 * Behaviour:
 *   - Listens once on `window` for the `trackfit:storage-warning` event.
 *   - First fire of the session shows the toast and persists a "warned"
 *     flag so the next 250 ms autosave tick doesn't spam another toast.
 *   - User taps Dismiss to close it. The flag stays set until a write
 *     later succeeds (handled inside `safeSetItem`), at which point the
 *     toast can fire again if storage fills back up.
 *   - No auto-dismiss timer — unlike the undo toast, this is critical
 *     information and the user needs to acknowledge it themselves.
 */
export function StorageWarningToast() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<StorageWarningEventDetail | null>(null);

  useEffect(() => {
    const onWarn = (e: Event) => {
      const ce = e as CustomEvent<StorageWarningEventDetail>;
      // Already warned this session → don't re-show. The flag persists
      // in localStorage so a 250 ms autosave loop hitting quota every
      // tick doesn't redraw the toast forever.
      if (hasBeenWarned()) return;
      markWarned();
      setDetail(ce.detail);
      setOpen(true);
    };
    window.addEventListener(STORAGE_WARNING_EVENT, onWarn as EventListener);
    return () => {
      window.removeEventListener(
        STORAGE_WARNING_EVENT,
        onWarn as EventListener,
      );
    };
  }, []);

  if (!open) return null;

  // The two failure modes have different actionable copy. We branch
  // here rather than in storage.ts so that module stays UI-free.
  const message =
    detail?.reason === "blocked"
      ? "Your browser is blocking storage for Trackfit (private browsing mode?). Your changes won't be saved when you close the page. Switch off private mode, or export your inventory before you leave."
      : "Your phone is out of space for Trackfit. Try deleting some photos from your inventory, or export your inventory to back it up first.";

  return createPortal(
    <div
      className="undo-toast"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <span className="undo-toast__msg">{message}</span>
      <button
        type="button"
        className="undo-toast__action"
        onClick={() => setOpen(false)}
      >
        Dismiss
      </button>
    </div>,
    document.body,
  );
}
