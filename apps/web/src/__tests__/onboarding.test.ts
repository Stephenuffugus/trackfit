/**
 * Onboarding flag tests.
 *
 * The flag `trackfit.onboarded.v1` controls first-run visibility of the
 * 3-card welcome modal. These tests pin the contract:
 *   1. Fresh user (no flag) → onboarding should show.
 *   2. Returning user (flag = "true") → onboarding should NOT show.
 *   3. "Show intro again" clears the flag.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isOnboarded,
  ONBOARDED_STORAGE_KEY,
  setOnboarded,
} from "../lib/prefs";

/**
 * Minimal in-memory localStorage shim so vitest (which runs in Node by
 * default for .test.ts) doesn't blow up on `localStorage is not defined`.
 * Mirrors the subset of the Storage API the prefs module touches.
 */
function installLocalStorageStub() {
  const store = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return store.size;
    },
    key: (n: number) => Array.from(store.keys())[n] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", stub);
  return stub;
}

describe("onboarding flag", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installLocalStorageStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows on first run when no flag is set", () => {
    expect(storage.getItem(ONBOARDED_STORAGE_KEY)).toBeNull();
    expect(isOnboarded()).toBe(false);
  });

  it("does not show after the flag is set to true", () => {
    setOnboarded(true);
    expect(storage.getItem(ONBOARDED_STORAGE_KEY)).toBe("true");
    expect(isOnboarded()).toBe(true);
  });

  it("'Show intro again' resets the flag", () => {
    setOnboarded(true);
    expect(isOnboarded()).toBe(true);

    // The settings menu's "Show intro again" calls setOnboarded(false).
    setOnboarded(false);

    expect(storage.getItem(ONBOARDED_STORAGE_KEY)).toBeNull();
    expect(isOnboarded()).toBe(false);
  });

  it("ignores non-true values for safety", () => {
    storage.setItem(ONBOARDED_STORAGE_KEY, "yes");
    expect(isOnboarded()).toBe(false);

    storage.setItem(ONBOARDED_STORAGE_KEY, "1");
    expect(isOnboarded()).toBe(false);

    storage.setItem(ONBOARDED_STORAGE_KEY, "");
    expect(isOnboarded()).toBe(false);
  });
});
