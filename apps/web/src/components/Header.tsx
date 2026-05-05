import type { InventoryRow } from "../lib/types";
import { SettingsMenu } from "./SettingsMenu";

interface HeaderProps {
  /**
   * Current inventory rows. Threaded through so the settings menu's
   * "Print inventory report" action has something to render. Optional
   * for callers that don't have an inventory in scope (e.g. tests).
   */
  inventory?: InventoryRow[];
}

/**
 * Top-of-page header. Eyebrow / Fraunces 900 wordmark / tagline.
 * Visual styling lives in `.app-header` rules in src/styles/index.css.
 *
 * The gear icon (top-right) opens the comfort-settings panel.
 */
export function Header({ inventory }: HeaderProps = {}) {
  return (
    <header className="app-header">
      <div className="app-header__row">
        <p className="eyebrow">Sectional Track Solver</p>
        <SettingsMenu inventory={inventory ?? []} />
      </div>
      <h1>Trackfit</h1>
      <p className="tagline">
        Tell it what's in your box and the gap you're trying to fill. It'll
        find every combination of pieces that fits — exactly or within
        tolerance.
      </p>
    </header>
  );
}
