import { useState } from "react";
import {
  type MarketplaceLink,
  searchLinks,
  searchLinksForMissingPiece,
} from "@trackfit/marketplace";
import type { Scale } from "@trackfit/library";

/**
 * Inline "Where to buy" panel for the SUGGESTED missing-piece callout.
 *
 * Two call shapes:
 *   - missingPiece + systemHint  → routes through searchLinksForMissingPiece,
 *     which knows how to build a query string from kind/length/radius/arc.
 *   - query (raw string)         → falls through to searchLinks directly.
 *
 * Renders the top 4 vendors by default, with a "Show 4 more" disclosure for
 * the rest. Each link opens in a new tab. The rationale prints under each
 * link in IBM Plex Mono italic — matches the bill-of-lading vibe of the
 * surrounding SUGGESTED frame.
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

  const visible = showAll ? links : links.slice(0, VISIBLE_BY_DEFAULT);
  const hiddenCount = links.length - VISIBLE_BY_DEFAULT;

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
        </div>
      ) : null}
    </div>
  );
}
