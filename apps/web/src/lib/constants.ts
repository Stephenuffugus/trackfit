/**
 * Cross-cutting constants for the Trackfit web app.
 *
 * STORAGE_KEY moved to v2 in v0.3 to accommodate the new gap-shape picker
 * (gap_shape / gap_arc_degrees / gap_offset). The loader migrates a v1 blob
 * on first read; see hooks/usePersistedState.ts.
 */
export const STORAGE_KEY = "trackfit.state.v2";
/** Older single-length-target schema. Read-once on migration. */
export const STORAGE_KEY_V1 = "trackfit.state.v1";
export const IN_TO_MM = 25.4;

export const MAX_PHOTO_DIM = 1200;
export const PHOTO_QUALITY = 0.82;

export const BAR_COLORS: string[] = [
  "var(--bar-1)",
  "var(--bar-2)",
  "var(--bar-3)",
  "var(--bar-4)",
  "var(--bar-5)",
  "var(--bar-6)",
  "var(--bar-7)",
  "var(--bar-8)",
];

export const DEFAULT_PRESET_ID = "lionel-fastrack";
/**
 * Default qty to assign to a library piece when loading a preset.
 *
 * v0.3.3: lowered from 4 → 0 after the focus-group stress test. Real
 * users do not own 4 of every piece in a system catalog (Walt's
 * 150-piece FasTrack collection has 0 of most catalog SKUs); the old
 * value forced ~30 rows of qty-editing on every preset load. With 0
 * the user adds quantities affirmatively via the per-row qty field
 * or the Add-piece picker (which still defaults its insertions to a
 * non-zero qty so manually-added pieces don't ghost-attach at 0).
 *
 * The picker's add-or-bump path does NOT consult this constant when
 * the row already exists — see piece-picker.ts addOrBump() — so a
 * user who taps the same piece in the picker twice gets qty: 2, not
 * qty: 0.
 */
export const DEFAULT_PRESET_QTY = 0;

/**
 * Curve-solver default tolerances. The handoff specifies these as v1 values
 * not exposed in the UI; "wiggle room" mm is the only knob the user sees and
 * it remaps to length_mm and lateral_offset_mm equally.
 */
export const DEFAULT_CURVE_TOL_LENGTH_MM = 2;
export const DEFAULT_CURVE_TOL_LATERAL_MM = 2;
export const DEFAULT_CURVE_TOL_ANGLE_DEG = 0.5;

/** Quick-pick arcs for the curve gap shape. */
export const CURVE_ARC_PRESETS: { label: string; degrees: number }[] = [
  { label: "Quarter turn (90°)", degrees: 90 },
  { label: "Eighth turn (45°)", degrees: 45 },
  { label: "Twelfth turn (30°)", degrees: 30 },
  { label: "Sixteenth turn (22.5°)", degrees: 22.5 },
];
