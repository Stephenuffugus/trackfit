/**
 * Top-of-page header. Eyebrow / Fraunces 900 wordmark / tagline.
 * Visual styling lives in `.app-header` rules in src/styles/index.css.
 */
export function Header() {
  return (
    <header className="app-header">
      <p className="eyebrow">Sectional Track Solver</p>
      <h1>Trackfit</h1>
      <p className="tagline">
        Tell it what's in your box and the gap you're trying to fill. It'll
        find every combination of pieces that fits — exactly or within
        tolerance.
      </p>
    </header>
  );
}
