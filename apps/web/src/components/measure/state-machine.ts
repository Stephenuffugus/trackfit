/**
 * Pure state-machine for the reference-object gap measurement overlay.
 *
 * Extracted from the React component so it can be tested without a DOM
 * harness. The overlay component owns a single `Phase` value and fans
 * actions through these transition helpers; nothing here touches React.
 *
 * Phase progression (linear, with Back/Cancel out-of-band):
 *
 *   pick-reference
 *        ↓ chooseReference(ref)
 *   place-reference-endpoints  (user drops two ends on the reference object)
 *        ↓ confirmReferenceEndpoints()  — only valid when both endpoints set
 *   place-gap-endpoints        (user drops two ends on the gap)
 *        ↓ confirmGapEndpoints()        — runs computeMeasurement()
 *   review                      (user confirms → emit gap_mm; or back)
 */

import {
  computeMeasurement,
  type MeasurementResult,
  type Point,
  type ReferenceObject,
} from "@trackfit/measure";

export type EndpointPair = [Point | null, Point | null];

export type Phase =
  | { kind: "pick-reference" }
  | {
      kind: "place-reference-endpoints";
      reference: ReferenceObject;
      endpoints: EndpointPair;
    }
  | {
      kind: "place-gap-endpoints";
      reference: ReferenceObject;
      refEndpoints: [Point, Point];
      endpoints: EndpointPair;
    }
  | {
      kind: "review";
      reference: ReferenceObject;
      refEndpoints: [Point, Point];
      gapEndpoints: [Point, Point];
      result: MeasurementResult;
    };

/* --------------------------------------------------------------------- */
/* Constructors                                                          */
/* --------------------------------------------------------------------- */

export function initialPhase(): Phase {
  return { kind: "pick-reference" };
}

/* --------------------------------------------------------------------- */
/* Transitions                                                           */
/* --------------------------------------------------------------------- */

/** Step 1 → 2. */
export function chooseReference(
  _phase: Phase,
  reference: ReferenceObject,
): Phase {
  return {
    kind: "place-reference-endpoints",
    reference,
    endpoints: [null, null],
  };
}

/**
 * Update one endpoint in the current phase. Indexes outside [0, 1] and
 * updates against a phase that has no endpoints (pick-reference / review)
 * are no-ops — the UI shouldn't be able to fire these but defensive
 * pure-functions keep tests honest.
 */
export function setEndpoint(phase: Phase, index: 0 | 1, point: Point): Phase {
  if (
    phase.kind !== "place-reference-endpoints" &&
    phase.kind !== "place-gap-endpoints"
  ) {
    return phase;
  }
  const next: EndpointPair = [phase.endpoints[0], phase.endpoints[1]];
  next[index] = point;
  return { ...phase, endpoints: next };
}

/** Both endpoints set in the current pair? */
export function isPairComplete(phase: Phase): boolean {
  if (
    phase.kind !== "place-reference-endpoints" &&
    phase.kind !== "place-gap-endpoints"
  ) {
    return false;
  }
  return phase.endpoints[0] !== null && phase.endpoints[1] !== null;
}

/** Step 2 → 3. Caller must check `isPairComplete` first. */
export function confirmReferenceEndpoints(phase: Phase): Phase {
  if (phase.kind !== "place-reference-endpoints") return phase;
  const [a, b] = phase.endpoints;
  if (!a || !b) return phase;
  return {
    kind: "place-gap-endpoints",
    reference: phase.reference,
    refEndpoints: [a, b],
    endpoints: [null, null],
  };
}

/**
 * Step 3 → 4. Caller must check `isPairComplete` first. Runs
 * `computeMeasurement` and stuffs the result into the review phase.
 */
export function confirmGapEndpoints(phase: Phase): Phase {
  if (phase.kind !== "place-gap-endpoints") return phase;
  const [a, b] = phase.endpoints;
  if (!a || !b) return phase;
  const result = computeMeasurement({
    reference: {
      p1: phase.refEndpoints[0],
      p2: phase.refEndpoints[1],
      dimension_mm: phase.reference.dimension_mm,
    },
    gap: { p1: a, p2: b },
  });
  return {
    kind: "review",
    reference: phase.reference,
    refEndpoints: phase.refEndpoints,
    gapEndpoints: [a, b],
    result,
  };
}

/**
 * Step a phase backward. Cancel from step 1 returns null (caller closes
 * the overlay); back from later steps returns to the previous phase with
 * the user's previous picks preserved where possible.
 */
export function back(phase: Phase): Phase | null {
  switch (phase.kind) {
    case "pick-reference":
      return null;
    case "place-reference-endpoints":
      return { kind: "pick-reference" };
    case "place-gap-endpoints":
      return {
        kind: "place-reference-endpoints",
        reference: phase.reference,
        endpoints: phase.refEndpoints,
      };
    case "review":
      return {
        kind: "place-gap-endpoints",
        reference: phase.reference,
        refEndpoints: phase.refEndpoints,
        endpoints: phase.gapEndpoints,
      };
  }
}
