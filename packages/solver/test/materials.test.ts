import { describe, expect, it } from "vitest";
import { findCombinationsOneMaterial, railMaterial, IN_TO_MM } from "../src/index.js";

const inch = (n: number) => n * IN_TO_MM;
describe("one rail material per answer", () => {
  const inv = [
    { label: '9" straight (nickel silver)', length_mm: inch(9), qty: 1 },
    { label: '9" straight (steel)', length_mm: inch(9), qty: 1 },
    { label: '6" straight (steel)', length_mm: inch(6), qty: 1 },
  ];
  it("reads the material from the label", () => {
    expect(railMaterial(inv[0]!.label)).toBe("nickel silver");
    expect(railMaterial(inv[1]!.label)).toBe("steel");
    expect(railMaterial('9" straight')).toBeUndefined();
  });
  it("18\" needs one 9\" of each material, so there is no answer, and it says why", () => {
    const r = findCombinationsOneMaterial(inv, inch(18), 0.5);
    expect(r.solutions).toEqual([]);
    expect(r.mixedWouldFit).toBe(true);
  });
  it("15\" is all steel and is found", () => {
    const r = findCombinationsOneMaterial(inv, inch(15), 0.5);
    expect(r.solutions.length).toBeGreaterThan(0);
    for (const s of r.solutions) for (const p of s.pieces) expect(railMaterial(p.label)).toBe("steel");
  });
});
