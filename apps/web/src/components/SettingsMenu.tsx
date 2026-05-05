import { useEffect, useRef, useState } from "react";
import {
  applyPrefsToDocument,
  loadPrefs,
  type Prefs,
  savePrefs,
  setOnboarded,
} from "../lib/prefs";

/**
 * Comfort-settings panel. A small gear button in the header opens a
 * dropdown panel with three controls:
 *
 *   - Bigger text  (toggles `data-large-text` on <html>)
 *   - High contrast (toggles `data-high-contrast` on <html>)
 *   - Show intro again (clears the onboarding flag and reloads)
 *
 * Toggle state persists to `trackfit.prefs.v1`. Initial application
 * happens at boot in main.tsx so the document never flashes the
 * default theme.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Persist + reflect to the document on every change.
  useEffect(() => {
    applyPrefsToDocument(prefs);
    savePrefs(prefs);
  }, [prefs]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const replayIntro = () => {
    setOnboarded(false);
    // Easiest way to re-trigger the first-run modal cleanly is to
    // reload — App reads the flag once at mount.
    window.location.reload();
  };

  return (
    <div className="settings-menu">
      <button
        ref={buttonRef}
        type="button"
        className="settings-trigger"
        aria-label="Open settings"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <GearIcon />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="settings-panel"
          role="dialog"
          aria-label="Comfort settings"
        >
          <p className="settings-panel__title">Comfort settings</p>
          <label className="settings-row">
            <span className="settings-row__label">
              <span className="settings-row__name">Bigger text</span>
              <span className="settings-row__hint">
                Increases body text by 25%.
              </span>
            </span>
            <input
              type="checkbox"
              checked={prefs.largeText}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, largeText: e.target.checked }))
              }
            />
          </label>
          <label className="settings-row">
            <span className="settings-row__label">
              <span className="settings-row__name">High contrast</span>
              <span className="settings-row__hint">
                Crisper black-on-white for bright rooms.
              </span>
            </span>
            <input
              type="checkbox"
              checked={prefs.highContrast}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, highContrast: e.target.checked }))
              }
            />
          </label>
          <button
            type="button"
            className="settings-row settings-row--button"
            onClick={replayIntro}
          >
            <span className="settings-row__label">
              <span className="settings-row__name">Show intro again</span>
              <span className="settings-row__hint">
                Replay the welcome cards.
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function GearIcon() {
  // Inline SVG — no icon library. Stroke uses currentColor so the
  // CSS rule on `.settings-trigger` paints it.
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
