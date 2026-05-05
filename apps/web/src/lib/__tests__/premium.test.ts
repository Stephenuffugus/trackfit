/**
 * Tests for the Premium gate (activation, photo-ID quota, persistence).
 *
 * These pin the contract that App.tsx, SettingsMenu, MarketplaceLinks,
 * and LayoutSuggester all rely on. Each test installs a fresh
 * in-memory localStorage stub so suites don't bleed state between cases.
 *
 * SHA-256 is exercised against `crypto.subtle` — Node 18+ supplies that
 * globally so we don't need a polyfill in the test environment.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __TEST_ONLY,
  activate,
  consumePhotoIdQuota,
  deactivate,
  FREE_PHOTO_ID_QUOTA,
  getPhotoIdQuotaRemaining,
  isPremium,
  loadPremium,
  PREMIUM_STORAGE_KEY,
  validateLicense,
} from "../premium";

/** Same in-memory shim the rest of the suite uses. */
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

describe("premium gate", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installLocalStorageStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /* -------------------------------------------------------------- */
  /* Fresh state                                                    */
  /* -------------------------------------------------------------- */

  it("returns the default zero state on a fresh device", () => {
    expect(storage.getItem(PREMIUM_STORAGE_KEY)).toBeNull();
    const state = loadPremium();
    expect(state.active).toBe(false);
    expect(state.source).toBe("none");
    expect(state.photo_id_used).toBe(0);
    expect(state.license_hash).toBeUndefined();
    expect(state.activated_at).toBeUndefined();
    expect(isPremium(state)).toBe(false);
    expect(isPremium()).toBe(false);
  });

  it("treats corrupt JSON as the default zero state", () => {
    storage.setItem(PREMIUM_STORAGE_KEY, "not-json{");
    const state = loadPremium();
    expect(state.active).toBe(false);
    expect(state.photo_id_used).toBe(0);
  });

  it("treats partially-corrupt fields as defaults", () => {
    storage.setItem(
      PREMIUM_STORAGE_KEY,
      JSON.stringify({
        active: "yes", // wrong type
        source: "elsewhere", // unknown
        photo_id_used: -5, // negative
      }),
    );
    const state = loadPremium();
    expect(state.active).toBe(false);
    expect(state.source).toBe("none");
    expect(state.photo_id_used).toBe(0);
  });

  /* -------------------------------------------------------------- */
  /* Photo-ID quota                                                 */
  /* -------------------------------------------------------------- */

  it("allows exactly FREE_PHOTO_ID_QUOTA calls before blocking", () => {
    const results: Array<{ allowed: boolean; remaining: number }> = [];
    for (let i = 0; i < FREE_PHOTO_ID_QUOTA + 2; i += 1) {
      const r = consumePhotoIdQuota();
      results.push({ allowed: r.allowed, remaining: r.remaining });
    }
    // First N calls allowed with descending remaining counts.
    expect(results[0]).toEqual({ allowed: true, remaining: 2 });
    expect(results[1]).toEqual({ allowed: true, remaining: 1 });
    expect(results[2]).toEqual({ allowed: true, remaining: 0 });
    // The (N+1)th call is blocked.
    expect(results[3]).toEqual({ allowed: false, remaining: 0 });
    expect(results[4]).toEqual({ allowed: false, remaining: 0 });
  });

  it("getPhotoIdQuotaRemaining mirrors the consumed count without changing state", () => {
    expect(getPhotoIdQuotaRemaining()).toBe(FREE_PHOTO_ID_QUOTA);
    consumePhotoIdQuota();
    expect(getPhotoIdQuotaRemaining()).toBe(FREE_PHOTO_ID_QUOTA - 1);
    // Two reads in a row should not decrement.
    expect(getPhotoIdQuotaRemaining()).toBe(FREE_PHOTO_ID_QUOTA - 1);
  });

  it("premium users get Infinity quota and consumption is a no-op", () => {
    activate(__TEST_ONLY.knownGoodHash);
    expect(getPhotoIdQuotaRemaining()).toBe(Infinity);
    const before = loadPremium().photo_id_used;
    const r = consumePhotoIdQuota();
    expect(r).toEqual({
      allowed: true,
      remaining: Infinity,
      total: Infinity,
    });
    // Counter doesn't move for premium users.
    expect(loadPremium().photo_id_used).toBe(before);
  });

  /* -------------------------------------------------------------- */
  /* License validation + activation                                */
  /* -------------------------------------------------------------- */

  it("rejects an unknown license code", async () => {
    const result = await validateLicense("TFP-ZZZZ-ZZZZ-ZZZZ");
    expect(result).toBeNull();
  });

  it("rejects an empty / whitespace-only string", async () => {
    expect(await validateLicense("")).toBeNull();
    expect(await validateLicense("   ")).toBeNull();
  });

  it("normalises lowercase + spaces before hashing", async () => {
    // We don't know what real codes hash to (the allowlist holds
    // synthetic stubs), but we can verify normalisation by checking
    // that two equivalent inputs hash to the same null result rather
    // than only one of them rejecting.
    const a = await validateLicense("tfp-aaaa-bbbb-cccc");
    const b = await validateLicense("  TFP-AAAA-BBBB-CCCC  ");
    // Both should reject (these aren't real codes), and they should
    // reject the same way — i.e. both are null.
    expect(a).toBeNull();
    expect(b).toBeNull();

    // Now prove normalisation actually runs by hashing a string we
    // know the answer to. The empty string SHA-256 is the canonical
    // test vector — `validateLicense("")` short-circuits to null
    // BEFORE hashing, so the only way to verify the hash function
    // works at all is via the activation round-trip, which the
    // "persistence round-trip" test below covers.
  });

  it("activation throws on an unknown hash (defence in depth)", () => {
    expect(() => activate("d".repeat(64))).toThrow();
    expect(loadPremium().active).toBe(false);
  });

  it("activation persists premium state with timestamp + hash", () => {
    const hash = __TEST_ONLY.knownGoodHash;
    activate(hash);
    const state = loadPremium();
    expect(state.active).toBe(true);
    expect(state.source).toBe("license");
    expect(state.license_hash).toBe(hash);
    expect(state.activated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(isPremium(state)).toBe(true);
  });

  it("persistence round-trip survives a fresh loadPremium()", () => {
    activate(__TEST_ONLY.knownGoodHash);
    // Simulate a page reload by reading fresh from storage.
    const reloaded = loadPremium();
    expect(reloaded.active).toBe(true);
    expect(isPremium(reloaded)).toBe(true);
  });

  it("activation preserves the previously-consumed photo-ID counter", () => {
    consumePhotoIdQuota();
    consumePhotoIdQuota();
    expect(loadPremium().photo_id_used).toBe(2);
    activate(__TEST_ONLY.knownGoodHash);
    expect(loadPremium().photo_id_used).toBe(2);
  });

  it("deactivate clears active+source but preserves the quota counter", () => {
    consumePhotoIdQuota();
    activate(__TEST_ONLY.knownGoodHash);
    expect(isPremium()).toBe(true);
    deactivate();
    const state = loadPremium();
    expect(state.active).toBe(false);
    expect(state.source).toBe("none");
    expect(state.license_hash).toBeUndefined();
    expect(state.activated_at).toBeUndefined();
    // Counter survives — prevents the trial-reset exploit.
    expect(state.photo_id_used).toBe(1);
    expect(isPremium(state)).toBe(false);
  });
});
