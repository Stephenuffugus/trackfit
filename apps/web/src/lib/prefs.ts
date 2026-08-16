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
}

export const DEFAULT_PREFS: Prefs = {
  largeText: false,
  highContrast: false,
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs> | null;
    if (!parsed) return DEFAULT_PREFS;
    // Rebuilt field-by-field rather than spread, so a stored blob from an
    // older build (which carried a now-retired `identify_on_capture` flag)
    // upgrades itself the next time savePrefs runs.
    return {
      largeText: !!parsed.largeText,
      highContrast: !!parsed.highContrast,
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
