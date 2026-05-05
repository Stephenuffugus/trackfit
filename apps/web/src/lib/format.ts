import { IN_TO_MM } from "./constants";
import type { Unit } from "./types";

/**
 * Round-to-hobbyist-precision and display a millimetre length in either
 * unit. Trailing zeros are trimmed.
 *
 * Hobbyists buy sectional track in clean fractions — 1/8" or 1/16"
 * resolution covers every standard piece across every system in the
 * library (1.375", 1.75", 4.5", 5", 9", etc.). Displaying "5.0207
 * inches" makes Trackfit feel like CAD software for engineers, which
 * is exactly the position the strategy doc tells us NOT to take.
 *
 * v0.3.6:
 *  - inches → round to nearest 1/16" (0.0625"), show with up to 2
 *    decimals after the round.
 *  - mm     → round to nearest 1 mm, show as integer.
 *
 * Underlying solver math is unchanged — only the rendered string
 * rounds. Fractional display ("5 1/16\"") is a polish task for
 * later; decimal-with-clean-rounding gets us 95% of the win tonight.
 */
export function formatLength(mm: number, unit: Unit): string {
  if (unit === "in") {
    const inches = mm / IN_TO_MM;
    // 16ths of an inch — covers 1/8 (0.125), 1/16 (0.0625), 3/8, 1/2,
    // 3/4 standard fractions cleanly.
    const rounded = Math.round(inches * 16) / 16;
    return parseFloat(rounded.toFixed(2)).toString();
  }
  // mm: round to the nearest whole mm. Sub-millimetre solver
  // residuals are real but never sold as catalog SKUs, so display
  // precision shouldn't pretend otherwise.
  return Math.round(mm).toString();
}

export function unitSuffix(unit: Unit): string {
  return unit === "in" ? '"' : "mm";
}

/**
 * Parse a length expression like "47", "47cm", "47 cm", "18.5in", or
 * "470mm". Returns null when the input is empty or unparseable.
 *
 * Bare numbers (no suffix) inherit the supplied `displayUnit`. Suffixed
 * numbers override — "47cm" is always 470 mm regardless of toggle.
 *
 * v0.3.3 — added in response to focus-group P4 (Frank, UK modeller)
 * silently breaking when typing "47" for a 47 cm gap. UK and continental
 * European modellers think in cm; the rest of the app stays in/mm.
 *
 * Returns both the user's-unit value (for display) and the canonical mm
 * value (for the solver). Letters are case-insensitive; whitespace
 * between number and suffix is allowed.
 */
export function parseLengthExpression(
  raw: string,
  displayUnit: Unit,
): { valueInUnit: number; mm: number } | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Match: optional sign, decimal number, optional whitespace, optional
  // unit suffix. We deliberately do NOT match feet-and-inches notation
  // ("4'2"") — that's a separate feature; the audience reads digits.
  const m = /^([+-]?\d*\.?\d+)\s*(in|mm|cm|")?$/i.exec(trimmed);
  if (!m) return null;
  const num = parseFloat(m[1]!);
  if (!Number.isFinite(num)) return null;

  const suffix = (m[2] ?? "").toLowerCase();
  let mm: number;
  if (suffix === "cm") {
    mm = num * 10;
  } else if (suffix === "mm") {
    mm = num;
  } else if (suffix === "in" || suffix === '"') {
    mm = num * IN_TO_MM;
  } else {
    // No suffix — inherit the display unit toggle.
    mm = displayUnit === "in" ? num * IN_TO_MM : num;
  }

  const valueInUnit = displayUnit === "in" ? mm / IN_TO_MM : mm;
  return { valueInUnit, mm };
}
