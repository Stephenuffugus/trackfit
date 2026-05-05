/**
 * Tests for the localStorage safety-net helper.
 *
 * Pins the contract that usePersistedState, prefs.savePrefs, and
 * inventory-io.importInventory rely on:
 *   - Normal writes succeed without throwing.
 *   - QuotaExceededError is classified as reason: "quota".
 *   - SecurityError (private-mode Safari) is classified as "blocked".
 *   - Failures NEVER throw — the caller always gets a structured result.
 *   - approximateUsedBytes returns a finite number when storage is
 *     available, null when introspection isn't.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approximateUsedBytes,
  emitStorageWarning,
  hasBeenWarned,
  markWarned,
  safeSetItem,
  SAFE_STORAGE_BUDGET_BYTES,
  STORAGE_WARNED_KEY,
  STORAGE_WARNING_EVENT,
} from "../storage";

/**
 * In-memory localStorage shim with a settable failure mode. Mirrors the
 * pattern in premium.test.ts so the suites stay readable side-by-side.
 *
 * `failNext` controls the next setItem call:
 *   - "quota" — throws a QuotaExceededError (Chrome / modern Safari).
 *   - "security" — throws a SecurityError (Safari Private Browsing).
 *   - "weird" — throws a generic Error (forces the "unknown" branch).
 *   - null — write succeeds.
 *
 * `failMode` applies to ALL subsequent writes until cleared. This lets
 * us simulate the "every autosave is failing" loop the hook hits when
 * a user has actually run out of space.
 */
function installLocalStorageStub() {
  const store = new Map<string, string>();
  let failMode: "quota" | "security" | "weird" | null = null;
  const stub: Storage = {
    get length() {
      return store.size;
    },
    key: (n: number) => Array.from(store.keys())[n] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (failMode === "quota") {
        const err = new Error("quota exceeded");
        err.name = "QuotaExceededError";
        throw err;
      }
      if (failMode === "security") {
        const err = new Error("blocked");
        err.name = "SecurityError";
        throw err;
      }
      if (failMode === "weird") {
        throw new Error("disk read error");
      }
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", stub);
  return {
    store,
    setFailMode(mode: "quota" | "security" | "weird" | null) {
      failMode = mode;
    },
  };
}

describe("safeSetItem", () => {
  let harness: ReturnType<typeof installLocalStorageStub>;

  beforeEach(() => {
    harness = installLocalStorageStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok:true on a normal write", () => {
    const result = safeSetItem("key", "value");
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.attempted_bytes).toBe("key".length + "value".length);
    expect(harness.store.get("key")).toBe("value");
  });

  it("classifies QuotaExceededError as reason: quota", () => {
    harness.setFailMode("quota");
    const result = safeSetItem("k", "v");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("quota");
    expect(result.error).toBeDefined();
  });

  it("classifies SecurityError as reason: blocked", () => {
    harness.setFailMode("security");
    const result = safeSetItem("k", "v");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("blocked");
  });

  it("classifies an unrecognised error as reason: unknown", () => {
    harness.setFailMode("weird");
    const result = safeSetItem("k", "v");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unknown");
  });

  it("does not throw on storage failures", () => {
    harness.setFailMode("quota");
    expect(() => safeSetItem("k", "v")).not.toThrow();
    harness.setFailMode("security");
    expect(() => safeSetItem("k", "v")).not.toThrow();
    harness.setFailMode("weird");
    expect(() => safeSetItem("k", "v")).not.toThrow();
  });

  it("reports attempted_bytes even when the write fails", () => {
    harness.setFailMode("quota");
    const result = safeSetItem("a-key", "a-value");
    expect(result.attempted_bytes).toBe("a-key".length + "a-value".length);
  });

  it("clears the warned flag after a successful write", () => {
    markWarned();
    expect(hasBeenWarned()).toBe(true);
    const result = safeSetItem("inventory", "...");
    expect(result.ok).toBe(true);
    expect(hasBeenWarned()).toBe(false);
  });
});

describe("approximateUsedBytes", () => {
  let harness: ReturnType<typeof installLocalStorageStub>;

  beforeEach(() => {
    harness = installLocalStorageStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a finite number after writing some data", () => {
    safeSetItem("foo", "hello");
    safeSetItem("bar", "world!");
    const used = approximateUsedBytes();
    expect(used).not.toBeNull();
    expect(Number.isFinite(used)).toBe(true);
    // Lower bound: at minimum the lengths of the values we just stored.
    // Upper bound: keys + values combined.
    expect(used!).toBeGreaterThanOrEqual("hello".length + "world!".length);
    expect(used!).toBeLessThanOrEqual(
      "foo".length + "hello".length + "bar".length + "world!".length,
    );
    // Sanity: harness store mirrors what we wrote.
    expect(harness.store.size).toBe(2);
  });

  it("returns 0 on an empty store", () => {
    expect(approximateUsedBytes()).toBe(0);
  });

  it("returns null when localStorage isn't available", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", undefined);
    expect(approximateUsedBytes()).toBeNull();
  });
});

describe("warning event + flag", () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emitStorageWarning fires the global event with the supplied detail", () => {
    // The default test runner is node — no DOM globals. Stub a minimal
    // window with EventTarget semantics (which Node ≥ 16 provides on
    // globalThis) so the dispatchEvent path works.
    const target = new EventTarget();
    const fakeWindow = {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    };
    vi.stubGlobal("window", fakeWindow);

    const seen: Array<{ reason: string; bytes: number | undefined }> = [];
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        reason: string;
        attempted_bytes?: number;
      }>;
      seen.push({
        reason: ce.detail.reason,
        bytes: ce.detail.attempted_bytes,
      });
    };
    target.addEventListener(STORAGE_WARNING_EVENT, handler as EventListener);
    emitStorageWarning({ reason: "quota", attempted_bytes: 1234 });
    target.removeEventListener(
      STORAGE_WARNING_EVENT,
      handler as EventListener,
    );
    expect(seen).toEqual([{ reason: "quota", bytes: 1234 }]);
  });

  it("emitStorageWarning is a no-op when window is undefined (SSR-safe)", () => {
    // Original installLocalStorageStub() leaves window undefined in the
    // node test runner; just verify no throw.
    expect(() => emitStorageWarning({ reason: "blocked" })).not.toThrow();
  });

  it("markWarned + hasBeenWarned round-trip via localStorage", () => {
    expect(hasBeenWarned()).toBe(false);
    markWarned();
    expect(hasBeenWarned()).toBe(true);
    expect(localStorage.getItem(STORAGE_WARNED_KEY)).toBe("true");
  });
});

describe("SAFE_STORAGE_BUDGET_BYTES", () => {
  it("is a sensible 4 MB constant", () => {
    expect(SAFE_STORAGE_BUDGET_BYTES).toBe(4 * 1024 * 1024);
  });
});
