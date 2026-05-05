import { useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { activate, validateLicense } from "../lib/premium";

interface Props {
  open: boolean;
  onClose: () => void;
  onActivated: () => void;
}

/**
 * "Activate Trackfit Premium" modal — paste a license code, get
 * unlocked. Stephen issues codes manually after a Stripe Checkout
 * completes; the user types the code (`TFP-XXXX-XXXX-XXXX`) into this
 * sheet and we hash + check it against the embedded allowlist.
 *
 * On success, the activation is persisted to localStorage by
 * `activate(hash)` and the parent's `onActivated` callback fires
 * (used by Settings to refresh the row state). On failure we show an
 * inline error and leave the field populated so the user can fix a
 * typo without re-typing.
 *
 * No new visual styles. Reuses `.modal` / `.modal-inner` /
 * `.field-label` / `.btn` / `.settings-row__hint` so the surface
 * matches the other modals in the kit. The two `style={}` props on
 * the input + error message use existing CSS variables (var(--accent)
 * etc.) — no new tokens, no new colors.
 */
export function LicenseActivation({ open, onClose, onActivated }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    onEscape: () => {
      if (!busy) onClose();
    },
  });

  if (!open) return null;

  const reset = () => {
    setCode("");
    setError(null);
    setBusy(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const hash = await validateLicense(code);
      if (!hash) {
        setError("That code didn't work. Check the dashes and try again.");
        setBusy(false);
        return;
      }
      // activate() throws if defence-in-depth fails — surface as the
      // same generic error so we don't leak which check rejected.
      activate(hash);
      reset();
      onActivated();
      onClose();
    } catch {
      setError("That code didn't work. Check the dashes and try again.");
      setBusy(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="modal open"
      role="dialog"
      aria-modal="true"
      aria-label="Activate Trackfit Premium"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) handleClose();
      }}
    >
      <div className="modal-inner">
        <p className="settings-panel__title">Activate Trackfit Premium</p>
        <p className="settings-row__hint">
          Type the code we emailed you. Lowercase is fine.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="trackfit-license-code">
            License code
          </label>
          <input
            id="trackfit-license-code"
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            placeholder="TFP-XXXX-XXXX-XXXX"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "trackfit-license-error" : undefined}
            // Inherits the global input[type="text"] style: IBM Plex Mono,
            // 14px, var(--bg) background. Letter-spacing + uppercase
            // make a 14-char code easier to scan; both reuse existing
            // tokens (no new color or font).
            style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
          />
          {error ? (
            <p
              id="trackfit-license-error"
              className="settings-row__hint"
              style={{ color: "var(--accent)" }}
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="modal-actions">
            <button
              type="button"
              className="btn"
              onClick={handleClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={busy || code.trim().length === 0}
            >
              {busy ? "Activating…" : "Activate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
