/**
 * Pure-math core of the reference-object gap measurement feature.
 *
 * Given:
 *   - two endpoints in pixel space marking a reference object whose real-world
 *     length we know (e.g. a US quarter's 24.26 mm diameter)
 *   - two endpoints in pixel space marking the gap edges
 *
 * Returns the gap's real-world length in millimeters by computing the
 * pixel-per-mm scale from the reference and applying it to the gap's
 * pixel distance.
 *
 * Assumptions and limits — read these before trusting the result:
 *   - The reference object and the gap are coplanar with the camera sensor.
 *     If the user photographs the gap from a sharp angle, the pixel ratio
 *     no longer equals the real-world ratio. We can't detect this without
 *     CV; we mitigate by surfacing reliability flags when the reference
 *     occupies too few pixels (likely far away or oblique).
 *   - Lens distortion is ignored. For phone cameras at typical hobbyist
 *     framing this is well under our few-mm error budget.
 *   - Pixel distances are Euclidean. No sub-pixel interpolation — the
 *     user's tap precision is the dominant error source anyway.
 */

export interface Point {
  x: number;
  y: number;
}

export interface MeasurementInput {
  reference: {
    p1: Point;
    p2: Point;
    /** Real-world length of the reference in millimeters. */
    dimension_mm: number;
  };
  gap: {
    p1: Point;
    p2: Point;
  };
}

export interface MeasurementResult {
  /** Pixels per real-world millimeter, derived from the reference object. */
  pixels_per_mm: number;
  /** Pixel distance between the two reference endpoints. */
  reference_pixel_distance: number;
  /** Pixel distance between the two gap endpoints. */
  gap_pixel_distance: number;
  /** The computed real-world gap length in millimeters. */
  gap_mm: number;
  /**
   * False when we have low confidence in the result — typically because the
   * reference object is too small in the frame to scale reliably. Clients
   * should still display the number but warn the user.
   */
  reliable: boolean;
  /** Human-readable advisory message; absent when nothing's wrong. */
  warning?: string;
}

/**
 * Below this many pixels, a reference object's endpoints are dominated by
 * tap precision (~5–10px on a phone) and the resulting scale is junk.
 * Empirically, anything under ~50px on a 1200px-wide photo is asking for
 * trouble — that's a US quarter occupying less than 1/24th of the frame.
 */
const REFERENCE_MIN_RELIABLE_PX = 50;

/**
 * Below this many pixels, the gap itself is so small that the user's tap
 * jitter on the endpoints is a meaningful fraction of the result. Still
 * compute a number, but flag it.
 */
const GAP_MIN_RELIABLE_PX = 20;

/**
 * If the user marks a gap pixel-distance more than 50× the reference,
 * either the reference is way off-screen or one of the four endpoints
 * is misplaced. Worth a sanity-check prompt.
 */
const SUSPICIOUS_GAP_TO_REF_RATIO = 50;

/**
 * Standard 2D Euclidean pixel distance between two points.
 */
export function pixelDistance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the gap's real-world length from a reference object and gap endpoints.
 *
 * Throws on inputs that make the math undefined: a reference object with
 * zero pixel length (both endpoints on the same pixel) or a non-positive
 * dimension. Everything else returns a result, possibly flagged unreliable.
 */
export function computeMeasurement(input: MeasurementInput): MeasurementResult {
  const { reference, gap } = input;

  if (!Number.isFinite(reference.dimension_mm) || reference.dimension_mm <= 0) {
    throw new Error(
      `computeMeasurement: reference.dimension_mm must be a positive finite number (got ${reference.dimension_mm})`,
    );
  }

  const reference_pixel_distance = pixelDistance(reference.p1, reference.p2);
  const gap_pixel_distance = pixelDistance(gap.p1, gap.p2);

  if (reference_pixel_distance === 0) {
    throw new Error(
      "computeMeasurement: reference endpoints are identical — cannot derive scale from a zero-length reference",
    );
  }

  const pixels_per_mm = reference_pixel_distance / reference.dimension_mm;
  const gap_mm = gap_pixel_distance / pixels_per_mm;

  // Reliability evaluation — order matters: prefer the most actionable
  // warning. Reference-too-small is the user's first thing to fix; the
  // others are secondary.
  let reliable = true;
  let warning: string | undefined;

  if (reference_pixel_distance < REFERENCE_MIN_RELIABLE_PX) {
    reliable = false;
    warning =
      "Reference too small in image — use a larger reference or move closer";
  } else if (gap_pixel_distance < GAP_MIN_RELIABLE_PX) {
    warning = "Gap too small to measure accurately";
  } else if (
    gap_pixel_distance / reference_pixel_distance >
    SUSPICIOUS_GAP_TO_REF_RATIO
  ) {
    warning =
      "Gap appears 50× larger than reference — double-check endpoint placement";
  }

  const result: MeasurementResult = {
    pixels_per_mm,
    reference_pixel_distance,
    gap_pixel_distance,
    gap_mm,
    reliable,
  };
  if (warning !== undefined) {
    result.warning = warning;
  }
  return result;
}
