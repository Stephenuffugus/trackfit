import { describe, expect, it } from "vitest";
import { buildBuyList } from "../src/index.js";
import type { PlanRequirement } from "../src/index.js";

describe("buildBuyList", () => {
  const reqs: PlanRequirement[] = [
    { system_id: "atlas-ho-code-83", product_code: "521", count: 4 },
    { system_id: "atlas-ho-code-83", product_code: "526", count: 2 },
  ];

  it("subtracts on-hand from required", () => {
    const list = buildBuyList({
      requirements: reqs,
      inventory: [
        { system_id: "atlas-ho-code-83", product_code: "521", qty: 1 },
        { system_id: "atlas-ho-code-83", product_code: "526", qty: 5 },
      ],
    });

    const nineInch = list.find((e) => e.product_code === "521")!;
    const sixInch = list.find((e) => e.product_code === "526")!;

    expect(nineInch.required).toBe(4);
    expect(nineInch.on_hand).toBe(1);
    expect(nineInch.to_buy).toBe(3);

    expect(sixInch.required).toBe(2);
    expect(sixInch.on_hand).toBe(5);
    // Already have enough — to_buy must be 0, not negative.
    expect(sixInch.to_buy).toBe(0);
  });

  it("returns to_buy: 0 (not dropped) when on-hand exactly equals required", () => {
    const list = buildBuyList({
      requirements: [
        { system_id: "atlas-ho-code-83", product_code: "521", count: 2 },
      ],
      inventory: [
        { system_id: "atlas-ho-code-83", product_code: "521", qty: 2 },
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0]!.to_buy).toBe(0);
  });

  it("matches by (system_id, product_code) before falling back to label", () => {
    // The label match would say 5 on-hand; the strict match says 1.
    // Strict must win.
    const list = buildBuyList({
      requirements: [
        { system_id: "atlas-ho-code-83", product_code: "521", count: 4 },
      ],
      inventory: [
        { system_id: "atlas-ho-code-83", product_code: "521", qty: 1 },
        { label: '9" straight', qty: 5 }, // no system/code => label-only
      ],
    });
    expect(list[0]!.on_hand).toBe(1);
    expect(list[0]!.to_buy).toBe(3);
  });

  it("falls back to label-exact match when (system_id, product_code) finds nothing", () => {
    const list = buildBuyList({
      requirements: [
        { system_id: "atlas-ho-code-83", product_code: "521", count: 4 },
      ],
      inventory: [
        // No system_id/product_code, but the label matches the canonical
        // library label for Atlas HO Code 83 piece 521 — '9" straight'.
        { label: '9" straight', qty: 2 },
      ],
    });
    expect(list[0]!.on_hand).toBe(2);
    expect(list[0]!.to_buy).toBe(2);
  });

  it("uses the library label when the system_id is known", () => {
    const list = buildBuyList({
      requirements: [
        { system_id: "atlas-ho-code-83", product_code: "521", count: 1 },
      ],
      inventory: [],
    });
    expect(list[0]!.label).toBe('9" straight');
  });

  it("falls back to product_code as label when system_id is unknown", () => {
    const list = buildBuyList({
      requirements: [
        { system_id: "unknown", product_code: "X-99", count: 1 },
      ],
      inventory: [],
    });
    expect(list[0]!.label).toBe("X-99");
  });

  it("sorts most-needed first, then by system_id and product_code", () => {
    const list = buildBuyList({
      requirements: [
        { system_id: "atlas-ho-code-83", product_code: "526", count: 2 },
        { system_id: "atlas-ho-code-83", product_code: "521", count: 10 },
        { system_id: "bachmann-ez-track-ho", product_code: "44581", count: 2 },
      ],
      inventory: [
        { system_id: "atlas-ho-code-83", product_code: "521", qty: 1 }, // to_buy=9
        { system_id: "atlas-ho-code-83", product_code: "526", qty: 0 }, // to_buy=2
        // bachmann row absent -> to_buy=2
      ],
    });
    // Tie at to_buy=2 between atlas/526 and bachmann/44581; system_id sorts
    // 'atlas-...' before 'bachmann-...' so 526 comes before 44581.
    expect(list.map((e) => e.product_code)).toEqual(["521", "526", "44581"]);
  });

  it("aggregates inventory rows that share system_id + product_code", () => {
    const list = buildBuyList({
      requirements: [
        { system_id: "atlas-ho-code-83", product_code: "521", count: 5 },
      ],
      inventory: [
        { system_id: "atlas-ho-code-83", product_code: "521", qty: 1 },
        { system_id: "atlas-ho-code-83", product_code: "521", qty: 2 },
      ],
    });
    expect(list[0]!.on_hand).toBe(3);
    expect(list[0]!.to_buy).toBe(2);
  });
});
