/**
 * Layer-2 fake-door pricing-feedback storage tests.
 *
 * These pin the contract that App.tsx relies on:
 *   1. Fresh device → hasAnswered() is false.
 *   2. recordAnswer() persists to the documented localStorage key.
 *   3. After recording, hasAnswered() returns true for that feature only.
 *   4. Defensive: a corrupt/non-array storage payload is treated as empty.
 *   5. The Tally POST is fired iff VITE_TALLY_PRICING_URL is set, and
 *      its failure is swallowed (telemetry must never break the UI).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasAnswered,
  listAnswers,
  PRICING_FEEDBACK_STORAGE_KEY,
  recordAnswer,
  type PricingFeedbackEntry,
} from "../lib/pricing-feedback";

/** Same in-memory shim onboarding.test.ts uses. */
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

const sampleEntry = (
  overrides: Partial<PricingFeedbackEntry> = {},
): PricingFeedbackEntry => ({
  answer: "19_once",
  feature: "photo_id",
  answered_at: "2026-05-05T12:00:00.000Z",
  app_version: "v0.3",
  inventory_size: 7,
  ...overrides,
});

describe("pricing-feedback storage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installLocalStorageStub();
    // Default: no Tally URL configured. Individual tests opt in.
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("hasAnswered is false for a fresh device", () => {
    expect(storage.getItem(PRICING_FEEDBACK_STORAGE_KEY)).toBeNull();
    expect(hasAnswered("photo_id")).toBe(false);
    expect(listAnswers()).toEqual([]);
  });

  it("recordAnswer persists to the documented localStorage key", async () => {
    const entry = sampleEntry();
    await recordAnswer(entry);

    const raw = storage.getItem(PRICING_FEEDBACK_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(entry);
  });

  it("flips hasAnswered to true for the recorded feature only", async () => {
    await recordAnswer(sampleEntry({ feature: "photo_id" }));
    expect(hasAnswered("photo_id")).toBe(true);
    // cloud_sync hasn't been answered — future-proof check.
    expect(hasAnswered("cloud_sync")).toBe(false);
  });

  it("appends multiple entries rather than overwriting", async () => {
    await recordAnswer(sampleEntry({ answer: "9_once" }));
    await recordAnswer(sampleEntry({ answer: "29_once" }));
    const all = listAnswers();
    expect(all).toHaveLength(2);
    expect(all.map((e) => e.answer)).toEqual(["9_once", "29_once"]);
  });

  it("treats a corrupt (non-JSON) storage payload as empty", () => {
    storage.setItem(PRICING_FEEDBACK_STORAGE_KEY, "not-json{");
    expect(listAnswers()).toEqual([]);
    expect(hasAnswered("photo_id")).toBe(false);
  });

  it("treats a non-array JSON payload as empty", () => {
    storage.setItem(
      PRICING_FEEDBACK_STORAGE_KEY,
      JSON.stringify({ answer: "9_once" }),
    );
    expect(listAnswers()).toEqual([]);
    expect(hasAnswered("photo_id")).toBe(false);
  });

  it("filters out malformed entries from a partially-corrupt array", () => {
    const good = sampleEntry();
    storage.setItem(
      PRICING_FEEDBACK_STORAGE_KEY,
      JSON.stringify([good, { not: "an entry" }, null, "string"]),
    );
    const all = listAnswers();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(good);
  });

  it("does NOT POST to Tally when VITE_TALLY_PRICING_URL is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // import.meta.env.VITE_TALLY_PRICING_URL is not defined in the test
    // env — the module's defensive read should handle that gracefully.
    await recordAnswer(sampleEntry());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("swallows fetch errors so telemetry can't break the UI", async () => {
    // Force the URL on so the POST path runs.
    vi.stubEnv("VITE_TALLY_PRICING_URL", "https://tally.so/r/test123");
    const fetchSpy = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(recordAnswer(sampleEntry())).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // The local log should still have it — that's the contract.
    expect(listAnswers()).toHaveLength(1);
  });

  it("POSTs JSON with keepalive when a Tally URL is configured", async () => {
    vi.stubEnv("VITE_TALLY_PRICING_URL", "https://tally.so/r/test123");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    const entry = sampleEntry({ comment: "love it" });
    await recordAnswer(entry);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://tally.so/r/test123");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body)).toEqual(entry);
  });
});
