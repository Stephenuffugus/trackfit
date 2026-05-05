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
 * History:
 *  - v0.3.0–v0.3.2: 4. Wrong for real users (no one owns 4 of every
 *    catalog SKU) but the demo path "load preset, hit Solve" worked.
 *  - v0.3.3: 0. Better for users editing a real inventory, but
 *    silently broke "load preset, hit Solve" — the solver correctly
 *    finds nothing because the user owns nothing. Stephen ran into
 *    this immediately on his own phone.
 *  - v0.3.5: 1. Splits the difference. The user sees "1 of each", the
 *    solver has actual pieces to work with on a load-and-solve demo,
 *    and the qty bumps still feel honest because nobody truly owns
 *    "4 of every piece" but most users own at least one of each
 *    standard piece in their system.
 *
 * The picker's add-or-bump path does NOT consult this constant when
 * the row already exists — see piece-picker.ts addOrBump() — so a
 * user who taps the same piece in the picker twice gets qty: 2.
 */
export const DEFAULT_PRESET_QTY = 1;

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
