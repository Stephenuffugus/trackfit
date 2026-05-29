import { describe, expect, it } from "vitest";
import type { InventoryRow } from "../types";
import { distinctScales, formatScales, hasMixedScales } from "../scale-check";

function row(partial: Partial<InventoryRow>): InventoryRow {
  return { label: "x", length_mm: 100, qty: 1, photo: null, ...partial };
}

describe("distinctScales / hasMixedScales", () => {
  it("returns nothing for an empty inventory", () => {
    expect(distinctScales([])).toEqual([]);
    expect(hasMixedScales([])).toBe(false);
  });

  it("ignores hand-typed rows that carry no system_id", () => {
    const rows = [row({ label: "mystery 5in straight" }), row({})];
    expect(distinctScales(rows)).toEqual([]);
    expect(hasMixedScales(rows)).toBe(false);
  });

  it("treats a single-system inventory as one scale, not mixed", () => {
    const rows = [
      row({ system_id: "atlas-ho-code-83" }),
      row({ system_id: "atlas-ho-code-83" }),
    ];
    expect(distinctScales(rows)).toEqual(["HO"]);
    expect(hasMixedScales(rows)).toBe(false);
  });

  it("does NOT flag same-scale brand mixing (the Margaret/P2-T2-F3 case)", () => {
    const rows = [
      row({ system_id: "atlas-ho-code-83" }),
      row({ system_id: "bachmann-ez-track-ho" }),
    ];
    expect(distinctScales(rows)).toEqual(["HO"]);
    expect(hasMixedScales(rows)).toBe(false);
  });

  it("flags a cross-scale mix (N + HO)", () => {
    const rows = [
      row({ system_id: "atlas-n-code-80" }),
      row({ system_id: "atlas-ho-code-83" }),
    ];
    expect(hasMixedScales(rows)).toBe(true);
    expect(distinctScales(rows).sort()).toEqual(["HO", "N"]);
  });

  it("flags three scales at once (O + HO + N)", () => {
    const rows = [
      row({ system_id: "lionel-fastrack" }),
      row({ system_id: "atlas-ho-code-83" }),
      row({ system_id: "kato-unitrack-n" }),
    ];
    expect(hasMixedScales(rows)).toBe(true);
    expect(distinctScales(rows)).toEqual(["O", "HO", "N"]);
  });
});

describe("formatScales", () => {
  it("joins with a serial 'and'", () => {
    expect(formatScales(["N"])).toBe("N");
    expect(formatScales(["N", "HO"])).toBe("N and HO");
    expect(formatScales(["O", "HO", "N"])).toBe("O, HO and N");
  });
});
