import { useEffect, useRef } from "react";
import type { TrackKind } from "@trackfit/library";
import { STORAGE_KEY, STORAGE_KEY_V1 } from "../lib/constants";
import { emitStorageWarning, safeSetItem } from "../lib/storage";
import type { GapShape, InventoryRow, PersistedState } from "../lib/types";

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

const VALID_GAP_SHAPES: ReadonlySet<GapShape> = new Set<GapShape>([
  "straight",
  "curve",
  "offset",
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
      const result = safeSetItem(STORAGE_KEY, JSON.stringify(state));
      if (!result.ok) {
        // Per [P6-T5-F1]: don't swallow this. The previous console.warn
        // wasn't visible to real users — they'd reload and find half
        // their inventory gone. We surface the failure via the global
        // storage-warning event; the StorageWarningToast renders it.
        // The in-memory React state is still correct, so the user can
        // keep working — handoff §3 (never block the user).
        console.warn("Trackfit: could not persist state", result.error);
        if (result.reason === "quota" || result.reason === "blocked") {
          emitStorageWarning({
            reason: result.reason,
            attempted_bytes: result.attempted_bytes,
          });
        }
      }
    }, 250);
    return () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
      }
    };
  }, [state]);
}

/**
 * Parse a raw object (possibly from v1 or v2) into a PersistedState.
 * v1 saves carry no gap_shape; we default to "straight" so the user's
 * previous single-length flow is preserved bit-for-bit.
 */
function normalize(parsed: Partial<PersistedState> | null): PersistedState | null {
  if (!parsed || !Array.isArray(parsed.inventory)) return null;
  const rawShape = (parsed as { gap_shape?: unknown }).gap_shape;
  const gap_shape: GapShape =
    typeof rawShape === "string" && VALID_GAP_SHAPES.has(rawShape as GapShape)
      ? (rawShape as GapShape)
      : "straight";
  return {
    unit: parsed.unit === "mm" ? "mm" : "in",
    inventory: parsed.inventory.map((p): InventoryRow => {
      const rawKind = (p as { kind?: unknown }).kind;
      const kind =
        typeof rawKind === "string" && VALID_KINDS.has(rawKind as TrackKind)
          ? (rawKind as TrackKind)
          : undefined;
      const radius = (p as { radius_mm?: unknown }).radius_mm;
      const arc = (p as { arc_degrees?: unknown }).arc_degrees;
      const turnoutFrog = (p as { turnout_frog?: unknown }).turnout_frog;
      const productCode = (p as { product_code?: unknown }).product_code;
      const row: InventoryRow = {
        label: String(p.label || ""),
        length_mm: Number(p.length_mm) || 0,
        qty: Math.max(0, parseInt(String(p.qty), 10) || 0),
        photo: p.photo || null,
      };
      if (kind) row.kind = kind;
      if (typeof radius === "number" && radius > 0) row.radius_mm = radius;
      if (typeof arc === "number" && arc > 0) row.arc_degrees = arc;
      if (typeof turnoutFrog === "string") row.turnout_frog = turnoutFrog;
      if (typeof productCode === "string") row.product_code = productCode;
      return row;
    }),
    gapPhoto: parsed.gapPhoto || null,
    target: parsed.target != null ? String(parsed.target) : "",
    tolerance: parsed.tolerance != null ? String(parsed.tolerance) : "0",
    gap_shape,
    gap_arc_degrees:
      parsed.gap_arc_degrees != null ? String(parsed.gap_arc_degrees) : "",
    gap_offset:
      parsed.gap_offset != null ? String(parsed.gap_offset) : "",
  };
}

export function loadPersisted(): PersistedState | null {
  try {
    // Prefer v2; fall back to migrating v1 (drop the v1 blob once we've
    // re-saved as v2 — the next write does that automatically).
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      return normalize(JSON.parse(rawV2) as Partial<PersistedState> | null);
    }
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (!rawV1) return null;
    const migrated = normalize(JSON.parse(rawV1) as Partial<PersistedState> | null);
    // Don't delete the v1 key here — keep it as a safety net until the user
    // makes their next edit (the v2 write happens via usePersistedState).
    return migrated;
  } catch (e) {
    console.warn("Trackfit: could not load persisted state", e);
    return null;
  }
}

export function clearPersisted(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_V1);
  } catch {
    /* noop */
  }
}
