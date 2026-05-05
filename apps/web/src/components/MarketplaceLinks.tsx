import { useState } from "react";
import {
  type MarketplaceLink,
  searchLinks,
  searchLinksForMissingPiece,
} from "@trackfit/marketplace";
import type { Scale } from "@trackfit/library";
import { PREMIUM } from "../lib/env";
import {
  FREE_MARKETPLACE_VENDOR_COUNT,
  isPremium,
} from "../lib/premium";
import { PremiumGate } from "./PremiumGate";

/**
 * Inline "Where to buy" panel for the SUGGESTED missing-piece callout.
 *
 * Two call shapes:
 *   - missingPiece + systemHint  → routes through searchLinksForMissingPiece,
 *     which knows how to build a query string from kind/length/radius/arc.
 *   - query (raw string)         → falls through to searchLinks directly.
 *
 * Free users see the top FREE_MARKETPLACE_VENDOR_COUNT vendors plus a
 * Premium upsell strip; premium users see the full ranked list. Each
 * link opens in a new tab. The rationale prints under each link in IBM
 * Plex Mono italic — matches the bill-of-lading vibe of the surrounding
 * SUGGESTED frame.
 */

interface SystemHint {
  id?: string;
  manufacturer?: string;
  scale?: Scale;
}

interface MissingPieceShape {
  kind?: string;
  label?: string;
  length_mm?: number;
  radius_mm?: number;
  arc_degrees?: number;
}

interface Props {
  /** Either pass a typed missing piece... */
  missingPiece?: MissingPieceShape;
  /** ...or a raw search query for the fallback path. */
  query?: string;
  /** System hint for vendor ordering and query enrichment (e.g. "Märklin"). */
  systemHint?: SystemHint;
}

const VISIBLE_BY_DEFAULT = 4;

export function MarketplaceLinks({ missingPiece, query, systemHint }: Props) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const links: MarketplaceLink[] = (() => {
    if (missingPiece) {
      return searchLinksForMissingPiece(missingPiece, systemHint);
    }
    if (query && query.trim().length > 0) {
      return searchLinks({
        query: query.trim(),
        scale: systemHint?.scale,
        system_id: systemHint?.id,
      });
    }
    return [];
  })();

  if (links.length === 0) return null;

  // Free-tier cap. When premium is disabled at the build level
  // (VITE_PREMIUM_ENABLED unset), behave like everyone is premium so
  // we don't hide vendors from free preview deployments.
  const premiumActive = !PREMIUM.enabled || isPremium();
  const freeCap = FREE_MARKETPLACE_VENDOR_COUNT;
  const cappedLinks = premiumActive ? links : links.slice(0, freeCap);

  const visible = showAll ? cappedLinks : cappedLinks.slice(0, VISIBLE_BY_DEFAULT);
  const hiddenCount = cappedLinks.length - VISIBLE_BY_DEFAULT;
  // How many vendors the user is NOT seeing because of the gate. We
  // surface this number in the upsell strip so the value of upgrading
  // is concrete ("see 6 more vendors", not just "see more vendors").
  const gatedCount = premiumActive ? 0 : Math.max(0, links.length - freeCap);

  return (
    <div className="marketplace-links">
      <button
        type="button"
        className="marketplace-links__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide vendor links" : "Where to buy →"}
      </button>
      {open ? (
        <div className="marketplace-links__panel" role="region" aria-label="Vendor search links">
          <ul className="marketplace-links__list">
            {visible.map((link) => (
              <li key={link.vendor} className="marketplace-link">
                <a
                  className="marketplace-link__url"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
                <span className="marketplace-link__rationale">{link.rationale}</span>
              </li>
            ))}
          </ul>
          {!showAll && hiddenCount > 0 ? (
            <button
              type="button"
              className="marketplace-links__more"
              onClick={() => setShowAll(true)}
            >
              Show {hiddenCount} more
            </button>
          ) : null}
          {gatedCount > 0 ? (
            <PremiumGate
              reason={`Premium unlocks ${gatedCount} more vendor${gatedCount === 1 ? "" : "s"}.`}
              onUpgrade={() => {
                // Bubble out to the global "open upgrade" listener
                // installed by SettingsMenu. Keeps PremiumGate free
                // of prop-drilling.
                window.dispatchEvent(
                  new CustomEvent("trackfit:open-upgrade"),
                );
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
