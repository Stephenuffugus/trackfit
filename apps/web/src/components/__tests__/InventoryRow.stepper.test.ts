/**
 * Qty-stepper math tests (focus-group P1-T2-F2 + P5-T2-F1).
 *
 * The stepper buttons in InventoryRow are large (44x44) hit targets that
 * fan into the same `onChange("qty", value)` handler as the existing text
 * input. The pure stepper math is extracted from the component so we can
 * test it without spinning up a DOM (the web project is configured for
 * pure-Vitest, no jsdom).
 */
import { describe, expect, it } from "vitest";
import { isDecDisabled, stepQty } from "../InventoryRow";

describe("InventoryRow stepper math", () => {
  it("stepQty('inc') increments by 1", () => {
    expect(stepQty(0, "inc")).toBe(1);
    expect(stepQty(4, "inc")).toBe(5);
    expect(stepQty(199, "inc")).toBe(200);
  });

  it("stepQty('dec') decrements by 1 and clamps at 0", () => {
    expect(stepQty(5, "dec")).toBe(4);
    expect(stepQty(1, "dec")).toBe(0);
    // Floor: never goes negative — a stuck-at-zero decrement is a no-op.
    expect(stepQty(0, "dec")).toBe(0);
  });

  it("stepQty has no upper bound (older O-scale collectors own 200+)", () => {
    // Focus-group P1-T2-F2: explicit requirement that qty is unbounded.
    expect(stepQty(999, "inc")).toBe(1000);
    expect(stepQty(1_000_000, "inc")).toBe(1_000_001);
  });

  it("stepQty coerces non-finite input to 0 defensively", () => {
    // Defensive against persisted-state corruption.
    expect(stepQty(NaN, "inc")).toBe(1);
    expect(stepQty(Infinity, "inc")).toBe(1);
    expect(stepQty(NaN, "dec")).toBe(0);
  });

  it("isDecDisabled returns true at the floor and false above it", () => {
    expect(isDecDisabled(0)).toBe(true);
    expect(isDecDisabled(-1)).toBe(true); // defensive — corrupted state
    expect(isDecDisabled(1)).toBe(false);
    expect(isDecDisabled(200)).toBe(false);
  });

  it("isDecDisabled treats non-finite qty as 0 (disabled)", () => {
    expect(isDecDisabled(NaN)).toBe(true);
  });
});
