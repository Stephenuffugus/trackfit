import { useEffect, useRef } from "react";
import type { TrackKind } from "@trackfit/library";
import { STORAGE_KEY } from "../lib/constants";
import type { InventoryRow, PersistedState } from "../lib/types";

/** Mirror of TrackKind, used to validate persisted strings without importing
 *  the library's runtime data. Keep in sync with @trackfit/library. */
const VALID_KINDS: ReadonlySet<TrackKind> = new Set<TrackKind>([
  "straight",
  "curve",
  "turnout",
  "crossing",
  "fitter",
  "flex",
  "rerailer",
  "bumper",
  "uncoupler",
  "transition",
]);

/**
 * Debounced (250ms) localStorage autosave for the entire app state, matching
 * v0.2's `persist()` behavior. The hook is fire-and-forget — pass it the
 * latest state on every render and it'll coalesce writes.
 *
 * Loading is handled separately by `loadPersisted()` so we can run it
 * synchronously before the first render and avoid a flicker.
 */
export function usePersistedState(state: PersistedState): void {
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        // Quota exceeded with many photos is the common case. Logging is
        // enough; the user's in-memory state still works for the session.
        console.warn("Trackfit: could not persist state", e);
      }
    }, 250);
    return () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
      }
    };
  }, [state]);
}

export function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState> | null;
    if (!parsed || !Array.isArray(parsed.inventory)) return null;
    return {
      unit: parsed.unit === "mm" ? "mm" : "in",
      inventory: parsed.inventory.map((p): InventoryRow => {
        const rawKind = (p as { kind?: unknown }).kind;
        const kind =
          typeof rawKind === "string" && VALID_KINDS.has(rawKind as TrackKind)
            ? (rawKind as TrackKind)
            : undefined;
        return {
          label: String(p.label || ""),
          length_mm: Number(p.length_mm) || 0,
          qty: Math.max(0, parseInt(String(p.qty), 10) || 0),
          photo: p.photo || null,
          ...(kind ? { kind } : {}),
        };
      }),
      gapPhoto: parsed.gapPhoto || null,
      target: parsed.target != null ? String(parsed.target) : "",
      tolerance: parsed.tolerance != null ? String(parsed.tolerance) : "0",
    };
  } catch (e) {
    console.warn("Trackfit: could not load persisted state", e);
    return null;
  }
}

export function clearPersisted(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
