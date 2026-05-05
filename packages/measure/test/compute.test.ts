import { describe, expect, it } from "vitest";
import {
  computeMeasurement,
  getReferenceById,
  pixelDistance,
  STANDARD_REFERENCES,
} from "../src/index.js";
import type { MeasurementInput } from "../src/index.js";

/**
 * Tests for the reference-object measurement math.
 *
 * The fixtures aim to mirror real hobbyist phone photos: a 1200px-wide
 * image (matches the v0.2 auto-resize target) with a coin or bill in
 * frame next to the gap. Numbers below are double-checked by hand so the
 * regressions are obvious if the math drifts.
 */

describe("pixelDistance", () => {
  it("returns the hypotenuse for a 3-4-5 triangle", () => {
    expect(pixelDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("returns the difference for a horizontal segment", () => {
    expect(pixelDistance({ x: 10, y: 5 }, { x: 30, y: 5 })).toBe(20);
  });

  it("returns the difference for a vertical segment", () => {
    expect(pixelDistance({ x: 7, y: 1 }, { x: 7, y: 8 })).toBe(7);
  });

  it("returns 0 for identical points", () => {
    expect(pixelDistance({ x: 42, y: 42 }, { x: 42, y: 42 })).toBe(0);
  });

  it("is direction-agnostic (symmetric in its arguments)", () => {
    const a = { x: -3, y: 11 };
    const b = { x: 9, y: -2 };
    expect(pixelDistance(a, b)).toBeCloseTo(pixelDistance(b, a), 12);
  });
});

describe("computeMeasurement — happy path", () => {
  it("scales a 200px gap against a 100px US quarter to ~48.52 mm", () => {
    const quarter = getReferenceById("us-quarter");
    expect(quarter).toBeDefined();
    const input: MeasurementInput = {
      reference: {
        p1: { x: 100, y: 100 },
        p2: { x: 200, y: 100 }, // 100 px diameter
        dimension_mm: quarter!.dimension_mm, // 24.26 mm
      },
      gap: {
        p1: { x: 300, y: 400 },
        p2: { x: 500, y: 400 }, // 200 px
      },
    };
    const r = computeMeasurement(input);
    expect(r.reference_pixel_distance).toBe(100);
    expect(r.gap_pixel_distance).toBe(200);
    // 200 px / (100 px / 24.26 mm) = 48.52 mm
    expect(r.gap_mm).toBeCloseTo(48.52, 4);
    expect(r.pixels_per_mm).toBeCloseTo(100 / 24.26, 6);
    expect(r.reliable).toBe(true);
    expect(r.warning).toBeUndefined();
  });

  it("real-world fixture: 1200px-wide photo, dollar bill spans 800px, 50px gap ~= 9.75 mm", () => {
    // 800 px / 156 mm = 5.128 px/mm, so a 50-px gap is 9.75 mm.
    const dollar = getReferenceById("us-dollar")!;
    const input: MeasurementInput = {
      reference: {
        p1: { x: 200, y: 600 },
        p2: { x: 1000, y: 600 }, // 800 px
        dimension_mm: dollar.dimension_mm, // 156 mm
      },
      gap: {
        p1: { x: 575, y: 300 },
        p2: { x: 625, y: 300 }, // 50 px
      },
    };
    const r = computeMeasurement(input);
    expect(r.reference_pixel_distance).toBe(800);
    expect(r.gap_pixel_distance).toBe(50);
    expect(r.pixels_per_mm).toBeCloseTo(800 / 156, 6);
    expect(r.gap_mm).toBeCloseTo(9.75, 2);
    expect(r.reliable).toBe(true);
    expect(r.warning).toBeUndefined();
  });

  it("handles diagonal endpoints via Euclidean distance", () => {
    // Reference endpoints span a 3-4-5 triangle = 5 px, with dimension_mm = 1
    // makes the scale trivially 5 px/mm. Gap of (6,8) = 10 px → 2 mm.
    const r = computeMeasurement({
      reference: {
        p1: { x: 0, y: 0 },
        p2: { x: 3, y: 4 },
        dimension_mm: 1,
      },
      gap: {
        p1: { x: 0, y: 0 },
        p2: { x: 6, y: 8 },
      },
    });
    // Reference is only 5 px → unreliable, but the math should still be exact.
    expect(r.reference_pixel_distance).toBe(5);
    expect(r.gap_pixel_distance).toBe(10);
    expect(r.pixels_per_mm).toBe(5);
    expect(r.gap_mm).toBe(2);
  });
});

describe("computeMeasurement — reliability flags", () => {
  it("flags an undersized reference (40 px) as unreliable", () => {
    const r = computeMeasurement({
      reference: {
        p1: { x: 0, y: 0 },
        p2: { x: 40, y: 0 }, // 40 px — below 50 px threshold
        dimension_mm: 24.26,
      },
      gap: {
        p1: { x: 0, y: 100 },
        p2: { x: 80, y: 100 },
      },
    });
    expect(r.reliable).toBe(false);
    expect(r.warning).toMatch(/reference too small/i);
  });

  it("does not flag a reference exactly at the 50 px threshold", () => {
    const r = computeMeasurement({
      reference: {
        p1: { x: 0, y: 0 },
        p2: { x: 50, y: 0 },
        dimension_mm: 24.26,
      },
      gap: {
        p1: { x: 0, y: 100 },
        p2: { x: 100, y: 100 },
      },
    });
    expect(r.reliable).toBe(true);
    expect(r.warning).toBeUndefined();
  });

  it("warns when the gap is smaller than 20 px even with a healthy reference", () => {
    const r = computeMeasurement({
      reference: {
        p1: { x: 0, y: 0 },
        p2: { x: 200, y: 0 }, // healthy reference
        dimension_mm: 24.26,
      },
      gap: {
        p1: { x: 100, y: 100 },
        p2: { x: 110, y: 100 }, // 10 px
      },
    });
    expect(r.reliable).toBe(true);
    expect(r.warning).toMatch(/gap too small/i);
  });

  it("warns when gap-to-reference ratio exceeds 50x", () => {
    // Reference 60 px (passes the 50-px floor), gap 6000 px → ratio 100.
    const r = computeMeasurement({
      reference: {
        p1: { x: 0, y: 0 },
        p2: { x: 60, y: 0 },
        dimension_mm: 24.26,
      },
      gap: {
        p1: { x: 0, y: 500 },
        p2: { x: 6000, y: 500 },
      },
    });
    expect(r.reliable).toBe(true);
    expect(r.warning).toMatch(/50.*larger than reference|double-check/i);
  });

  it("ratio warning fires only above the 50x boundary, not at it", () => {
    // Exactly 50× should NOT warn (we warn on strictly greater than 50).
    const r = computeMeasurement({
      reference: {
        p1: { x: 0, y: 0 },
        p2: { x: 60, y: 0 },
        dimension_mm: 24.26,
      },
      gap: {
        p1: { x: 0, y: 500 },
        p2: { x: 3000, y: 500 }, // 50× exactly
      },
    });
    expect(r.warning).toBeUndefined();
  });
});

describe("computeMeasurement — input validation", () => {
  it("throws on identical reference endpoints (zero-length reference)", () => {
    expect(() =>
      computeMeasurement({
        reference: {
          p1: { x: 5, y: 5 },
          p2: { x: 5, y: 5 },
          dimension_mm: 24.26,
        },
        gap: { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } },
      }),
    ).toThrow(/zero-length/i);
  });

  it("throws on non-positive dimension_mm", () => {
    expect(() =>
      computeMeasurement({
        reference: {
          p1: { x: 0, y: 0 },
          p2: { x: 100, y: 0 },
          dimension_mm: 0,
        },
        gap: { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } },
      }),
    ).toThrow(/positive/i);

    expect(() =>
      computeMeasurement({
        reference: {
          p1: { x: 0, y: 0 },
          p2: { x: 100, y: 0 },
          dimension_mm: -5,
        },
        gap: { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } },
      }),
    ).toThrow(/positive/i);
  });
});

describe("references catalog", () => {
  it("contains all expected canonical reference ids", () => {
    const ids = STANDARD_REFERENCES.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "us-dollar",
        "us-quarter",
        "eu-1-euro",
        "uk-1-pound",
        "us-penny",
        "ho-9in-straight",
        "fastrack-10in-straight",
      ]),
    );
  });

  it("returns undefined for unknown ids", () => {
    expect(getReferenceById("not-a-thing")).toBeUndefined();
  });

  it("returns the right object by id with the right dimension", () => {
    expect(getReferenceById("us-quarter")?.dimension_mm).toBe(24.26);
    expect(getReferenceById("us-dollar")?.dimension_mm).toBe(156.0);
    expect(getReferenceById("fastrack-10in-straight")?.dimension_mm).toBe(254.0);
  });
});
