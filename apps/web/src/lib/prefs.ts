/**
 * User comfort preferences. Stored in localStorage at `trackfit.prefs.v1`
 * and applied as `data-*` attributes on the document root so CSS rules
 * can scope themselves without re-rendering React.
 *
 * Applied synchronously at boot from `main.tsx` BEFORE React hydrates,
 * to avoid a flash-of-default-style on slow devices.
 */

import { emitStorageWarning, safeSetItem } from "./storage";

export const PREFS_STORAGE_KEY = "trackfit.prefs.v1";
export const ONBOARDED_STORAGE_KEY = "trackfit.onboarded.v1";

export interface Prefs {
  largeText: boolean;
  highContrast: boolean;
  /**
   * When true, every captured photo is fed through the photo-ID
   * identifier and (if confident) used to auto-fill the row. Default
   * on — the gesture is the whole point of the feature for tests with
   * older hobbyists. Users who don't want the magic can flip it off.
   */
  identify_on_capture: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  largeText: false,
  highContrast: false,
  identify_on_capture: true,
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs> | null;
    if (!parsed) return DEFAULT_PREFS;
    return {
      largeText: !!parsed.largeText,
      highContrast: !!parsed.highContrast,
      // Default-on: undefined in legacy storage means "user has never
      // expressed an opinion", and the default is on.
      identify_on_capture:
        parsed.identify_on_capture === undefined
          ? true
          : !!parsed.identify_on_capture,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  const result = safeSetItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  if (!result.ok && (result.reason === "quota" || result.reason === "blocked")) {
    // Prefs are tiny — a quota failure here means the rest of storage
    // is already stuffed, so the user definitely wants to know.
    emitStorageWarning({
      reason: result.reason,
      attempted_bytes: result.attempted_bytes,
    });
  }
}

/**
 * Mirror prefs onto the <html> element via data attributes. CSS rules
 * scope to `html[data-large-text="true"]` etc.
 */
export function applyPrefsToDocument(prefs: Prefs): void {
  const root = document.documentElement;
  if (prefs.largeText) {
    root.setAttribute("data-large-text", "true");
  } else {
    root.removeAttribute("data-large-text");
  }
  if (prefs.highContrast) {
    root.setAttribute("data-high-contrast", "true");
  } else {
    root.removeAttribute("data-high-contrast");
  }
}

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setOnboarded(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(ONBOARDED_STORAGE_KEY);
    }
  } catch {
    /* noop */
  }
}
