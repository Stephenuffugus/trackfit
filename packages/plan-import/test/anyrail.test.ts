import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePlan } from "../src/index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

describe("parsePlan (AnyRail)", () => {
  it("returns the right requirements for atlas-ho-simple.xml", () => {
    const result = parsePlan(loadFixture("atlas-ho-simple.xml"));

    expect(result.format).toBe("anyrail");
    expect(result.name).toBe("My HO Loop");
    expect(result.warnings).toEqual([]);

    const sorted = [...result.requirements].sort((a, b) =>
      a.product_code.localeCompare(b.product_code),
    );
    expect(sorted).toEqual([
      { system_id: "atlas-ho-code-83", product_code: "521", count: 4 },
      { system_id: "atlas-ho-code-83", product_code: "526", count: 2 },
    ]);
  });

  it("aggregates duplicate piece elements into a count", () => {
    const result = parsePlan(loadFixture("atlas-ho-simple.xml"));
    const nineInch = result.requirements.find((r) => r.product_code === "521");
    expect(nineInch?.count).toBe(4);
  });

  it("handles malformed-graceful.xml without throwing and surfaces a warning", () => {
    expect(() => parsePlan(loadFixture("malformed-graceful.xml"))).not.toThrow();
    const result = parsePlan(loadFixture("malformed-graceful.xml"));
    expect(result.requirements).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/XML parse failed/i);
  });

  it("returns a parse-failed warning for empty input", () => {
    const result = parsePlan("");
    expect(result.requirements).toEqual([]);
    expect(result.warnings[0]).toMatch(/XML parse failed/i);
  });

  it("returns a parse-failed warning when the AnyRail root is missing", () => {
    const result = parsePlan(
      `<?xml version="1.0"?><not-anyrail><piece /></not-anyrail>`,
    );
    expect(result.warnings[0]).toMatch(/no <anyrail-plan> root/i);
  });

  it("flags unknown library ids as warnings and tags them system_id=unknown", () => {
    const result = parsePlan(loadFixture("mixed-brands.xml"));
    const unknown = result.requirements.find((r) => r.system_id === "unknown");
    expect(unknown).toBeDefined();
    expect(unknown?.product_code).toBe("X-99");
    expect(
      result.warnings.some((w) =>
        w.includes("some-future-system-not-in-trackfit"),
      ),
    ).toBe(true);
  });

  it("warns about <piece> elements missing required attributes", () => {
    const result = parsePlan(loadFixture("mixed-brands.xml"));
    expect(
      result.warnings.some((w) => /missing library-id or piece-code/i.test(w)),
    ).toBe(true);
  });

  it("decodes XML entities in the plan name", () => {
    const result = parsePlan(loadFixture("mixed-brands.xml"));
    expect(result.name).toBe("Garage Layout & Branch");
  });

  it("ignores foreign elements inside <pieces> without complaint", () => {
    const result = parsePlan(loadFixture("mixed-brands.xml"));
    // The <annotation> element should not show up anywhere.
    for (const req of result.requirements) {
      expect(req.product_code).not.toBe("note");
    }
  });

  it("tolerates self-closing variants and single-quoted attributes", () => {
    const xml = `<?xml version="1.0"?><anyrail-plan name='Quoted'><pieces><piece library-id='atlas-ho-code-83' piece-code='521'></piece><piece library-id='atlas-ho-code-83' piece-code='521'/></pieces></anyrail-plan>`;
    const result = parsePlan(xml);
    expect(result.name).toBe("Quoted");
    expect(result.requirements).toEqual([
      { system_id: "atlas-ho-code-83", product_code: "521", count: 2 },
    ]);
  });
});
