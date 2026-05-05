import { describe, expect, it } from "vitest";
import { getReferenceById } from "@trackfit/measure";
import {
  back,
  chooseReference,
  confirmGapEndpoints,
  confirmReferenceEndpoints,
  initialPhase,
  isPairComplete,
  setEndpoint,
} from "../state-machine";

/**
 * State-machine integration tests for the GapMeasureOverlay.
 *
 * These exercise the pure transition functions only — no React, no DOM.
 * If any of these regress, the overlay's step flow is broken and the
 * user will get stuck mid-measurement.
 */

const quarter = getReferenceById("us-quarter")!;

describe("state-machine — initial phase", () => {
  it("starts in pick-reference", () => {
    expect(initialPhase().kind).toBe("pick-reference");
  });
});

describe("state-machine — happy path", () => {
  it("walks pick → place-ref → place-gap → review with correct kind ordering", () => {
    let phase = initialPhase();

    phase = chooseReference(phase, quarter);
    expect(phase.kind).toBe("place-reference-endpoints");

    phase = setEndpoint(phase, 0, { x: 100, y: 100 });
    phase = setEndpoint(phase, 1, { x: 200, y: 100 });
    expect(isPairComplete(phase)).toBe(true);

    phase = confirmReferenceEndpoints(phase);
    expect(phase.kind).toBe("place-gap-endpoints");
    if (phase.kind !== "place-gap-endpoints") throw new Error("bad kind");
    // 24.26mm reference @ 100px reference span = 100/24.26 ≈ 4.122 px/mm.
    expect(phase.refEndpoints).toEqual([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);

    phase = setEndpoint(phase, 0, { x: 50, y: 300 });
    phase = setEndpoint(phase, 1, { x: 850, y: 300 });
    phase = confirmGapEndpoints(phase);

    expect(phase.kind).toBe("review");
    if (phase.kind !== "review") throw new Error("bad kind");
    // 800px gap / (100px / 24.26mm) = 800 * 24.26 / 100 = 194.08mm.
    expect(phase.result.gap_mm).toBeCloseTo(194.08, 2);
    expect(phase.result.reliable).toBe(true);
  });
});

describe("state-machine — guards", () => {
  it("isPairComplete is false when fewer than two endpoints set", () => {
    let phase = chooseReference(initialPhase(), quarter);
    expect(isPairComplete(phase)).toBe(false);
    phase = setEndpoint(phase, 0, { x: 1, y: 1 });
    expect(isPairComplete(phase)).toBe(false);
    phase = setEndpoint(phase, 1, { x: 2, y: 2 });
    expect(isPairComplete(phase)).toBe(true);
  });

  it("confirmReferenceEndpoints is a no-op when called from the wrong phase", () => {
    const phase = initialPhase();
    expect(confirmReferenceEndpoints(phase)).toBe(phase);
  });

  it("confirmGapEndpoints is a no-op when endpoints are missing", () => {
    const refPlaced = confirmReferenceEndpoints(
      setEndpoint(
        setEndpoint(chooseReference(initialPhase(), quarter), 0, {
          x: 0,
          y: 0,
        }),
        1,
        { x: 100, y: 0 },
      ),
    );
    // No gap endpoints set yet — should remain in place-gap-endpoints.
    const same = confirmGapEndpoints(refPlaced);
    expect(same.kind).toBe("place-gap-endpoints");
  });

  it("setEndpoint on a phase without endpoints is a no-op", () => {
    const phase = initialPhase();
    expect(setEndpoint(phase, 0, { x: 1, y: 2 })).toBe(phase);
  });
});

describe("state-machine — back navigation", () => {
  it("returns null from pick-reference (caller should close)", () => {
    expect(back(initialPhase())).toBeNull();
  });

  it("returns to pick-reference from place-reference-endpoints", () => {
    const next = back(chooseReference(initialPhase(), quarter));
    expect(next?.kind).toBe("pick-reference");
  });

  it("preserves the user's reference endpoint picks when going back from gap step", () => {
    let phase = chooseReference(initialPhase(), quarter);
    phase = setEndpoint(phase, 0, { x: 10, y: 10 });
    phase = setEndpoint(phase, 1, { x: 110, y: 10 });
    phase = confirmReferenceEndpoints(phase);
    const prev = back(phase);
    expect(prev?.kind).toBe("place-reference-endpoints");
    if (prev?.kind !== "place-reference-endpoints") throw new Error("bad kind");
    expect(prev.endpoints).toEqual([
      { x: 10, y: 10 },
      { x: 110, y: 10 },
    ]);
  });

  it("preserves the user's gap endpoint picks when going back from review", () => {
    let phase = chooseReference(initialPhase(), quarter);
    phase = setEndpoint(phase, 0, { x: 10, y: 10 });
    phase = setEndpoint(phase, 1, { x: 110, y: 10 });
    phase = confirmReferenceEndpoints(phase);
    phase = setEndpoint(phase, 0, { x: 20, y: 50 });
    phase = setEndpoint(phase, 1, { x: 220, y: 50 });
    phase = confirmGapEndpoints(phase);
    const prev = back(phase);
    expect(prev?.kind).toBe("place-gap-endpoints");
    if (prev?.kind !== "place-gap-endpoints") throw new Error("bad kind");
    expect(prev.endpoints).toEqual([
      { x: 20, y: 50 },
      { x: 220, y: 50 },
    ]);
  });
});

describe("state-machine — measurement reliability surfaces", () => {
  it("flags an unreliable result when the reference span is < 50px", () => {
    let phase = chooseReference(initialPhase(), quarter);
    phase = setEndpoint(phase, 0, { x: 0, y: 0 });
    phase = setEndpoint(phase, 1, { x: 30, y: 0 }); // only 30px ref
    phase = confirmReferenceEndpoints(phase);
    phase = setEndpoint(phase, 0, { x: 0, y: 100 });
    phase = setEndpoint(phase, 1, { x: 200, y: 100 });
    phase = confirmGapEndpoints(phase);
    if (phase.kind !== "review") throw new Error("bad kind");
    expect(phase.result.reliable).toBe(false);
    expect(phase.result.warning).toMatch(/too small/i);
  });
});
