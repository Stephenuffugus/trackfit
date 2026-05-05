/**
 * Cross-cutting constants for the Trackfit web app.
 *
 * STORAGE_KEY matches v0.2 exactly so users upgrading from the single-file
 * prototype keep their inventory.
 */
export const STORAGE_KEY = "trackfit.state.v1";
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
/** Default qty to assign to a library piece when loading a preset. */
export const DEFAULT_PRESET_QTY = 4;
