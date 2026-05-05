import { SettingsMenu } from "./SettingsMenu";

/**
 * Top-of-page header. Eyebrow / Fraunces 900 wordmark / tagline.
 * Visual styling lives in `.app-header` rules in src/styles/index.css.
 *
 * The gear icon (top-right) opens the comfort-settings panel.
 */
export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__row">
        <p className="eyebrow">Sectional Track Solver</p>
        <SettingsMenu />
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
