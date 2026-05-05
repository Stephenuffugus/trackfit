/**
 * Centralised localStorage write helper.
 *
 * Why this exists: most browsers cap localStorage at ~5 MB (Safari) — 10 MB
 * for Chromium. A 50-piece inventory with photos averaging 200 KB easily
 * blows past Safari's cap, and the old try/catch swallowed
 * QuotaExceededError silently. The user saw a happy UI right up until they
 * reloaded and half their inventory was gone. Per the focus-group stress
 * test [P6-T5-F1] (and strategy doc §3.6 on "abandonment trauma"), silent
 * data loss is the cardinal sin for our older audience.
 *
 * This module is the detect-and-warn safety net. The bigger fix — moving
 * photos out of localStorage and into IndexedDB — is a deferred round-3
 * task. For now, classify every write failure and let the UI surface a
 * concrete next step ("delete some photos / export your inventory").
 *
 * No third-party deps; pure DOM + TypeScript.
 */

export interface SafeStorageWriteResult {
  ok: boolean;
  /** "quota" — over the browser's localStorage limit. "blocked" — private mode / disabled. "unknown" — anything else. */
  reason?: "quota" | "blocked" | "unknown";
  /** Approximate bytes the write attempted. Used for the user-facing message. */
  attempted_bytes?: number;
  /** Original error (the caller may want to log). */
  error?: unknown;
}

/**
 * Conservative budget for "almost full" warnings. The real cap is browser-
 * dependent (Chromium ~10 MB, Safari ~5 MB) and we can't introspect it,
 * so we play safe at 4 MB — well under Safari's limit but still leaves
 * room for a meaningful inventory.
 */
export const SAFE_STORAGE_BUDGET_BYTES = 4 * 1024 * 1024;

/**
 * Persisted flag — "user has been warned about storage in this session of
 * the app". Stops the 250 ms autosave loop from spamming the toast every
 * tick while writes are failing. Cleared the next time a write succeeds
 * so a user who frees up space gets a fresh warning if they fill it again.
 */
export const STORAGE_WARNED_KEY = "trackfit.storage_warned.v1";

/** Custom event fired on `window` whenever a quota write fails. The host
 *  app listens once and renders a toast. We use a window event (rather
 *  than a React context) so non-React modules — inventory-io.ts,
 *  prefs.ts — can broadcast without dependency-injection. */
export const STORAGE_WARNING_EVENT = "trackfit:storage-warning";

export interface StorageWarningEventDetail {
  reason: "quota" | "blocked" | "unknown";
  attempted_bytes?: number;
}

/** True if the user has already been shown the storage-full toast in
 *  this device-session. Survives reloads (it's localStorage-backed) on
 *  purpose — once warned, don't re-pester until they free space and a
 *  successful write clears the flag. */
export function hasBeenWarned(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(STORAGE_WARNED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Mark that we showed the warning. Best-effort — if this write itself
 *  fails (because we're literally out of quota) we silently no-op; the
 *  in-memory event already fired so the user did see the toast. */
export function markWarned(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_WARNED_KEY, "true");
  } catch {
    /* best-effort */
  }
}

function clearWarned(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(STORAGE_WARNED_KEY);
  } catch {
    /* best-effort */
  }
}

/** Fire the global storage-warning event so any listening UI shell can
 *  render its toast. Idempotent against re-firing — listeners decide
 *  whether to ignore based on `hasBeenWarned()`. */
export function emitStorageWarning(detail: StorageWarningEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<StorageWarningEventDetail>(STORAGE_WARNING_EVENT, {
      detail,
    }),
  );
}

/**
 * Wrap localStorage.setItem with a typed error result. Never throws.
 *
 * Quota classification: the standard QuotaExceededError name is what
 * Chrome / Firefox throw. Some older Safari builds throw a generic
 * DOMException with "QUOTA" in the message; we match /quota/i too.
 *
 * Blocked classification: SecurityError in Safari Private Browsing
 * (where localStorage exists but every setItem throws).
 */
export function safeSetItem(
  key: string,
  value: string,
): SafeStorageWriteResult {
  // UTF-16 length is a close-enough proxy for byte cost. Browsers vary
  // in internal encoding (some store UTF-8, some UTF-16) — we don't
  // need precision, just an order-of-magnitude number for the message.
  const attempted_bytes = key.length + value.length;
  try {
    if (typeof localStorage === "undefined") {
      return {
        ok: false,
        reason: "blocked",
        attempted_bytes,
        error: new Error("localStorage is not available"),
      };
    }
    localStorage.setItem(key, value);
    // A successful write clears the "already warned" flag — so a user
    // who deletes some photos and frees up space will get a fresh
    // warning if they fill it again later. The clear is scoped to
    // writes for keys other than the warn-flag itself, so we don't
    // race with markWarned() inside the same tick.
    if (key !== STORAGE_WARNED_KEY) {
      clearWarned();
    }
    return { ok: true, attempted_bytes };
  } catch (error) {
    const reason = classifyError(error);
    return { ok: false, reason, attempted_bytes, error };
  }
}

function classifyError(error: unknown): "quota" | "blocked" | "unknown" {
  if (error && typeof error === "object") {
    const name = (error as { name?: unknown }).name;
    const message = (error as { message?: unknown }).message;
    const code = (error as { code?: unknown }).code;
    const nameStr = typeof name === "string" ? name : "";
    const msgStr = typeof message === "string" ? message : "";
    // Standard DOMException name (Chrome, Firefox, modern Safari).
    if (nameStr === "QuotaExceededError") return "quota";
    // Legacy Firefox numeric code.
    if (nameStr === "NS_ERROR_DOM_QUOTA_REACHED") return "quota";
    // Legacy WebKit numeric code on DOMException.
    if (code === 22 || code === 1014) return "quota";
    // Last-resort message sniff for stragglers.
    if (/quota/i.test(msgStr)) return "quota";
    // Private-mode Safari throws SecurityError on every setItem.
    if (nameStr === "SecurityError") return "blocked";
  }
  return "unknown";
}

/**
 * Best-effort read of how full localStorage is (in bytes). Iterates every
 * key and sums (key.length + value.length). Returns null if localStorage
 * isn't available (SSR, private mode where access throws).
 *
 * Cheap to call — even a large inventory has only a handful of keys, and
 * .length is O(1) on JS strings.
 */
export function approximateUsedBytes(): number | null {
  try {
    if (typeof localStorage === "undefined") return null;
    let total = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const value = localStorage.getItem(key);
      total += key.length + (value !== null ? value.length : 0);
    }
    return total;
  } catch {
    return null;
  }
}
