import { IN_TO_MM } from "./constants";
import type { Unit } from "./types";

/** Display a millimeter length in either unit, trimming trailing zeros. */
export function formatLength(mm: number, unit: Unit): string {
  if (unit === "in") {
    const v = mm / IN_TO_MM;
    return parseFloat(v.toFixed(4)).toString();
  }
  return parseFloat(mm.toFixed(2)).toString();
}

export function unitSuffix(unit: Unit): string {
  return unit === "in" ? '"' : "mm";
}
