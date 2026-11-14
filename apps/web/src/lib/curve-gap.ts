import type { CurveTarget } from "@trackfit/solver";

/**
 * A curved gap as the user measures it: the straight-line distance between
 * the two track ends (the chord) and how far the track turns. For a
 * circular arc the chord leaves at half the turn angle, so the end point
 * sits chord·cos(a/2) ahead and chord·sin(a/2) to the side.
 *
 * (Before 14 Nov 2026 the app sent the chord as the forward distance and
 * chord·(1 − cos a)/2 as the sideways one, so even a single curve of the
 * gap's own size was reported as "no exact fit".)
 */
export function chordToCurveTarget(chord_mm: number, arc_degrees: number): CurveTarget {
  const half = ((arc_degrees * Math.PI) / 180) / 2;
  return {
    length_mm: chord_mm * Math.cos(half),
    lateral_offset_mm: chord_mm * Math.sin(half),
    angle_degrees: arc_degrees,
  };
}
