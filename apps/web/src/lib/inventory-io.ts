/**
 * Inventory backup / restore — file-based.
 *
 * Why this exists: the friend's-of-the-author target user fills out the
 * inventory once and never wants to do it again. localStorage doesn't
 * survive a phone swap or a "Clear browsing data" tap, so we ship a
 * portable JSON file the user can email to themselves.
 *
 * Schema is versioned. v1 carries `inventory`, the gap fields the v2 store
 * already persists (target / tolerance / shape / arc / offset), and the
 * comfort prefs. Bumps go in `SCHEMA_VERSION`; older versions stay
 * importable by `validate()` until we explicitly drop them.
 *
 * The import path WRITES to the same localStorage keys the app reads at
 * boot (STORAGE_KEY for state, PREFS_STORAGE_KEY for prefs), then triggers
 * a reload. This sidesteps App.tsx — we don't need a setter prop drilled
 * down, and we don't risk a half-applied state.
 */

import { STORAGE_KEY } from "./constants";
import { PREFS_STORAGE_KEY, type Prefs } from "./prefs";
import {
  approximateUsedBytes,
  emitStorageWarning,
  safeSetItem,
  SAFE_STORAGE_BUDGET_BYTES,
} from "./storage";
import type { GapShape, InventoryRow, PersistedState } from "./types";

export const SCHEMA_VERSION = 1;
export const SCHEMA_MAGIC = "trackfit.inventory" as const;

/**
 * Wire format. Top-level fields are stable across a major version; new
 * optional fields can land on a minor without breaking older importers.
 */
export interface InventoryBackup {
  /** literal "trackfit.inventory" — sanity check before parsing further */
  schema: typeof SCHEMA_MAGIC;
  /** integer; bump on incompatible changes */
  schema_version: number;
  /** ISO 8601 — informational only, shown in the import-confirm prompt */
  exported_at: string;
  /** the user's full inventory rows, byte-for-byte from PersistedState */
  inventory: InventoryRow[];
  /**
   * Gap configuration captured at export time. Optional — older backups
   * exported before the gap-shape picker landed will lack this. The import
   * path leaves the user's existing gap untouched if absent.
   */
  gap?: {
    target: string;
    tolerance: string;
    gap_shape?: GapShape;
    gap_arc_degrees?: string;
    gap_offset?: string;
  };
  /** Comfort prefs (large text, high contrast). Optional. */
  prefs?: Prefs;
  /** Display unit at export time. */
  unit?: "in" | "mm";
}

const VALID_KINDS = new Set([
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

const VALID_GAP_SHAPES = new Set<GapShape>(["straight", "curve", "offset"]);

/**
 * Strict-ish validation. Rejects anything that doesn't smell like a real
 * Trackfit export. Returns the typed shape on success; throws with a
 * human-readable message on failure (caller surfaces it via alert()).
 */
export function validate(input: unknown): InventoryBackup {
  if (!input || typeof input !== "object") {
    throw new Error("Not a valid Trackfit backup file (empty or wrong type).");
  }
  const obj = input as Record<string, unknown>;
  if (obj.schema !== SCHEMA_MAGIC) {
    throw new Error(
      "Not a Trackfit backup file. The 'schema' field is missing or wrong.",
    );
  }
  const ver = obj.schema_version;
  if (typeof ver !== "number" || !Number.isFinite(ver) || ver < 1) {
    throw new Error("Backup is missing a valid schema_version.");
  }
  if (ver > SCHEMA_VERSION) {
    throw new Error(
      `Backup was made by a newer version of Trackfit (schema v${ver}).` +
        " Update the app and try again.",
    );
  }
  if (!Array.isArray(obj.inventory)) {
    throw new Error("Backup is missing an inventory list.");
  }
  // Lenient row validation — same approach as usePersistedState's normalize.
  // We don't reject a row for missing optional fields; we coerce/drop them.
  const inventory = obj.inventory.map((rawRow, i) => {
    if (!rawRow || typeof rawRow !== "object") {
      throw new Error(`Inventory row ${i + 1} is not an object.`);
    }
    const r = rawRow as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label : "";
    const length_mm = Number(r.length_mm);
    const qty = Math.max(0, parseInt(String(r.qty), 10) || 0);
    if (!label || !Number.isFinite(length_mm)) {
      throw new Error(
        `Inventory row ${i + 1} is missing a label or length.`,
      );
    }
    const row: InventoryRow = {
      label,
      length_mm,
      qty,
      photo: typeof r.photo === "string" ? r.photo : null,
    };
    if (typeof r.kind === "string" && VALID_KINDS.has(r.kind)) {
      row.kind = r.kind as InventoryRow["kind"];
    }
    if (typeof r.radius_mm === "number" && r.radius_mm > 0) {
      row.radius_mm = r.radius_mm;
    }
    if (typeof r.arc_degrees === "number" && r.arc_degrees > 0) {
      row.arc_degrees = r.arc_degrees;
    }
    if (typeof r.turnout_frog === "string") {
      row.turnout_frog = r.turnout_frog;
    }
    if (typeof r.product_code === "string") {
      row.product_code = r.product_code;
    }
    return row;
  });

  const out: InventoryBackup = {
    schema: SCHEMA_MAGIC,
    schema_version: ver,
    exported_at:
      typeof obj.exported_at === "string"
        ? obj.exported_at
        : new Date().toISOString(),
    inventory,
  };

  // Optional sub-objects ----------------------------------------------------
  if (obj.gap && typeof obj.gap === "object") {
    const g = obj.gap as Record<string, unknown>;
    const gap: NonNullable<InventoryBackup["gap"]> = {
      target: g.target != null ? String(g.target) : "",
      tolerance: g.tolerance != null ? String(g.tolerance) : "0",
    };
    if (typeof g.gap_shape === "string" && VALID_GAP_SHAPES.has(g.gap_shape as GapShape)) {
      gap.gap_shape = g.gap_shape as GapShape;
    }
    if (g.gap_arc_degrees != null) gap.gap_arc_degrees = String(g.gap_arc_degrees);
    if (g.gap_offset != null) gap.gap_offset = String(g.gap_offset);
    out.gap = gap;
  }
  if (obj.prefs && typeof obj.prefs === "object") {
    const p = obj.prefs as Record<string, unknown>;
    out.prefs = {
      largeText: !!p.largeText,
      highContrast: !!p.highContrast,
      // Default-on when the imported backup pre-dates the photo-ID feature.
      identify_on_capture:
        p.identify_on_capture === undefined ? true : !!p.identify_on_capture,
    };
  }
  if (obj.unit === "mm" || obj.unit === "in") {
    out.unit = obj.unit;
  }

  return out;
}

/**
 * Build the export payload from the live PersistedState + Prefs and trigger
 * a download. Filename: trackfit-inventory-YYYY-MM-DD.json so a user with
 * three exports has a sensible chronological list in their Downloads folder.
 */
export function exportInventory(state: PersistedState, prefs: Prefs): void {
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const backup: InventoryBackup = {
    schema: SCHEMA_MAGIC,
    schema_version: SCHEMA_VERSION,
    exported_at: now.toISOString(),
    inventory: state.inventory,
    unit: state.unit,
    gap: {
      target: state.target,
      tolerance: state.tolerance,
      ...(state.gap_shape ? { gap_shape: state.gap_shape } : {}),
      ...(state.gap_arc_degrees ? { gap_arc_degrees: state.gap_arc_degrees } : {}),
      ...(state.gap_offset ? { gap_offset: state.gap_offset } : {}),
    },
    prefs,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `trackfit-inventory-${isoDate}.json`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * Apply a validated backup. Writes to the same localStorage keys App.tsx
 * reads at boot and reloads the page so the new state takes effect cleanly.
 *
 * Caller is responsible for the user-confirmation step (see SettingsMenu).
 * This function assumes the user has already said "yes, replace my data."
 */
export function importInventory(backup: InventoryBackup): void {
  // Reconstruct a v2 PersistedState. Falls back to safe defaults for the
  // gap fields when the backup didn't include them.
  const persisted: PersistedState = {
    unit: backup.unit ?? "in",
    inventory: backup.inventory,
    gapPhoto: null, // photos don't transfer via JSON; we don't promise them
    target: backup.gap?.target ?? "",
    tolerance: backup.gap?.tolerance ?? "0",
    gap_shape: backup.gap?.gap_shape ?? "straight",
    gap_arc_degrees: backup.gap?.gap_arc_degrees ?? "",
    gap_offset: backup.gap?.gap_offset ?? "",
  };

  const stateResult = safeSetItem(STORAGE_KEY, JSON.stringify(persisted));
  if (!stateResult.ok) {
    if (
      stateResult.reason === "quota" ||
      stateResult.reason === "blocked"
    ) {
      // Surface the warning toast even though we're about to throw —
      // the caller catches and shows an alert(), but the toast keeps
      // the message visible after the alert is dismissed and the
      // page hasn't reloaded.
      emitStorageWarning({
        reason: stateResult.reason,
        attempted_bytes: stateResult.attempted_bytes,
      });
    }
    throw new Error(
      "Could not save the imported inventory — your browser's storage is full or blocked.",
    );
  }
  if (backup.prefs) {
    const prefsResult = safeSetItem(
      PREFS_STORAGE_KEY,
      JSON.stringify(backup.prefs),
    );
    if (
      !prefsResult.ok &&
      (prefsResult.reason === "quota" || prefsResult.reason === "blocked")
    ) {
      // Inventory landed but prefs didn't fit. Don't fail the whole
      // import — comfort prefs are recoverable from the Settings menu.
      emitStorageWarning({
        reason: prefsResult.reason,
        attempted_bytes: prefsResult.attempted_bytes,
      });
    }
  }

  // Reload so App.tsx re-reads from localStorage with no half-applied state.
  window.location.reload();
}

/**
 * Approximate the byte cost of writing a backup to localStorage. Used by
 * the import pre-flight to surface a "this is large" confirmation BEFORE
 * the write attempt, so a user importing a 6 MB backup on a Safari
 * device gets a chance to bail rather than discovering the failure
 * after the page reloads.
 */
export function estimateBackupBytes(backup: InventoryBackup): number {
  // The persisted shape is a different layout from the backup file but
  // the heavy payload (photos in `inventory[].photo`) is identical. A
  // serialise-once measurement is cheaper than constructing the full
  // PersistedState just to size it.
  const proxy: PersistedState = {
    unit: backup.unit ?? "in",
    inventory: backup.inventory,
    gapPhoto: null,
    target: backup.gap?.target ?? "",
    tolerance: backup.gap?.tolerance ?? "0",
    gap_shape: backup.gap?.gap_shape ?? "straight",
    gap_arc_degrees: backup.gap?.gap_arc_degrees ?? "",
    gap_offset: backup.gap?.gap_offset ?? "",
  };
  const stateJson = JSON.stringify(proxy);
  const prefsJson = backup.prefs ? JSON.stringify(backup.prefs) : "";
  return STORAGE_KEY.length + stateJson.length +
    PREFS_STORAGE_KEY.length + prefsJson.length;
}

/**
 * Decide whether the user should see the "this backup is large" warning.
 * Returns the warning text (caller appends it to the import-confirm
 * dialog) or null if no warning is needed.
 *
 * Threshold: the backup itself exceeds SAFE_STORAGE_BUDGET_BYTES. Import
 * overwrites the existing state under STORAGE_KEY, so we don't need to
 * add current usage — but other keys (premium state, photo-id quota,
 * onboarding flag, etc.) still cost a few bytes, well below the noise
 * floor at this scale.
 */
export function buildImportSizeWarning(
  backup: InventoryBackup,
): string | null {
  const bytes = estimateBackupBytes(backup);
  if (bytes < SAFE_STORAGE_BUDGET_BYTES) return null;
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return (
    `This backup is large (${mb} MB) — your phone has limited space ` +
    `for browser apps. You can still import it, but you may need to ` +
    `delete photos later. Continue?`
  );
}

/** Re-export for callers that want the fixed budget. */
export { SAFE_STORAGE_BUDGET_BYTES, approximateUsedBytes };

/**
 * Read a File (typically from <input type="file">) and parse it as an
 * InventoryBackup. Rejects on parse error or schema mismatch.
 */
export async function readBackupFile(file: File): Promise<InventoryBackup> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  return validate(parsed);
}

/**
 * Human-readable confirmation prompt for the import flow. Shows piece count,
 * export date, and the photo caveat. Plain-English on purpose — the target
 * user is older and may have only ever seen this dialog twice in their life.
 */
export function buildImportConfirmMessage(backup: InventoryBackup): string {
  const count = backup.inventory.length;
  const date = backup.exported_at.slice(0, 10);
  const noun = count === 1 ? "piece" : "pieces";
  const hadPhotos = backup.inventory.some((r) => !!r.photo);
  const photoNote = hadPhotos
    ? " Photos will only transfer if they were saved with this backup."
    : " Photos won't transfer if they were originally on another device.";
  const sizeWarning = buildImportSizeWarning(backup);
  // Prepend the size warning so it lands first in a confirm() — older
  // users scan top-down and a "this might break" cue belongs above the
  // routine details. The trailing "Continue?" in the warning replaces
  // the implicit confirm prompt without needing two dialogs.
  const sizePrefix = sizeWarning ? `${sizeWarning}\n\n` : "";
  return (
    `${sizePrefix}This will replace your current inventory with ${count} ` +
    `${noun} from ${date}.${photoNote}`
  );
}
