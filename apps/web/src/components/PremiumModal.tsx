import { useFocusTrap } from "../hooks/useFocusTrap";
import { PREMIUM } from "../lib/env";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * "Trackfit Premium" upsell modal — the Layer-4 validation stub.
 *
 * The modal lays out two paid tiers (lifetime + monthly) and a
 * "no thanks" button. Each paid card opens its configured URL in a new
 * tab on click. When a tier's URL env var is empty/unset, the card
 * renders disabled with a "Coming soon" caption — this lets us ship the
 * modal before any payment links exist.
 *
 * No analytics, no tracking, no Stripe SDK. Just two outbound links and
 * a button. The whole point is to prove there's demand before Stephen
 * spends money on payment infrastructure.
 *
 * Visual styles reuse the existing `.modal` / `.modal-inner` /
 * `.btn` / `.settings-row` classes — premium UI changes are
 * permission-gated per handoff §9.
 */
export function PremiumModal({ open, onClose }: Props) {
  // ESC + Tab cycling. Initial focus lands on the first focusable
  // descendant (the lifetime card or, if disabled, the monthly card,
  // or finally the dismiss button) — the focus-trap hook handles the
  // disabled-button skipping for us via its `:not([disabled])` filter.
  const containerRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    onEscape: onClose,
  });

  if (!open) return null;

  const openExternal = (url: string) => {
    // `noopener,noreferrer` is the standard hardening for new-tab links —
    // prevents the destination page from reaching back into our window.
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  const lifetimeReady = PREMIUM.lifetimeUrl.length > 0;
  const monthlyReady = PREMIUM.monthlyUrl.length > 0;
  // v0.3.3 — when no payment URLs are configured (Stephen hasn't
  // decided pricing yet), the modal should NOT pretend to be a
  // shop-front. Showing two disabled "Coming soon" buttons reads
  // as "the app can't do this" to every persona in the focus-group
  // stress test (top-1 friction). When neither URL is set we render
  // a calm "not on sale yet" body and a single dismiss button.
  const anyTierReady = lifetimeReady || monthlyReady;

  return (
    <div
      ref={containerRef}
      className="modal open"
      role="dialog"
      aria-modal="true"
      aria-label="Trackfit Premium"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <p className="settings-panel__title">Trackfit Premium</p>
        {anyTierReady ? (
          <p className="settings-row__hint">
            More tools for the workbench. Pay once, keep forever.
          </p>
        ) : (
          <p className="settings-row__hint">
            Photo-ID, the printable inventory binder, and the full vendor
            list will be a paid upgrade. We're still figuring out a fair
            price — Trackfit Premium isn't on sale yet.
          </p>
        )}

        {lifetimeReady ? (
          <button
            type="button"
            className="settings-row settings-row--button"
            onClick={() => openExternal(PREMIUM.lifetimeUrl)}
          >
            <span className="settings-row__label">
              <span className="settings-row__name">
                Lifetime — once · {PREMIUM.lifetimePrice}
              </span>
              <span className="settings-row__hint">
                Photo-ID, cloud sync, printable cut templates, marketplace
                shortcuts.
              </span>
            </span>
          </button>
        ) : null}

        {monthlyReady ? (
          <button
            type="button"
            className="settings-row settings-row--button"
            onClick={() => openExternal(PREMIUM.monthlyUrl)}
          >
            <span className="settings-row__label">
              <span className="settings-row__name">
                Monthly · {PREMIUM.monthlyPrice}
              </span>
              <span className="settings-row__hint">Cancel any time.</span>
            </span>
          </button>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {anyTierReady ? "No thanks" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}
