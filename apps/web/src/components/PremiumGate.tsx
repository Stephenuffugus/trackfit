import type { ReactNode } from "react";

interface Props {
  /** Placeholder content describing the gated value, e.g. a vendor row stub. */
  children?: ReactNode;
  /** Short pitch, e.g. "See all 8 vendors with Premium". */
  reason: string;
  /** Tap handler — wired by the parent to open the upgrade modal. */
  onUpgrade: () => void;
}

/**
 * Inline upsell strip for surfaces where a feature is partly visible
 * (top 2 vendors) and the rest is paywalled. The `children` slot is
 * optional — pass it when there's a meaningful preview to render
 * above the CTA, leave it out when the strip stands alone.
 *
 * No new visual styles. Reuses `.settings-row__hint` for the pitch
 * and `.btn` for the call-to-action so the strip blends with the
 * rest of the panel.
 */
export function PremiumGate({ children, reason, onUpgrade }: Props) {
  return (
    <div className="premium-gate">
      {children}
      <div
        className="premium-gate__cta"
        // Tiny utility-style layout. Uses CSS variables and px values
        // already in the kit — no new tokens.
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginTop: "8px",
          flexWrap: "wrap",
        }}
      >
        <span className="settings-row__hint">{reason}</span>
        <button type="button" className="btn" onClick={onUpgrade}>
          Upgrade →
        </button>
      </div>
    </div>
  );
}
