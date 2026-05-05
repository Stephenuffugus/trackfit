import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderInventoryReport } from "../src/index.js";

/**
 * Inventory report renderer tests.
 *
 * The bar here is "doesn't crash on real-world rough data, produces a PDF
 * that page-counts correctly, and survives both supported paper sizes."
 * Pixel-perfect layout assertions are deliberately not made — the document
 * is rendered for human eyes, and small layout drift over time should not
 * trip CI. We test invariants the user can feel.
 */

describe("renderInventoryReport — basic rendering", () => {
  it("renders a 3-row inventory to a non-empty PDF on Letter", async () => {
    const result = await renderInventoryReport({
      owner_label: "Stephen",
      generated_at: "2026-05-05",
      paper_size: "letter",
      rows: [
        {
          label: "9-inch straight",
          kind: "straight",
          length_mm: 228.6,
          qty: 8,
          product_code: "6-12014",
        },
        {
          label: "O36 curve",
          kind: "curve",
          length_mm: null,
          radius_mm: 457.2,
          arc_degrees: 30,
          qty: 12,
          product_code: "6-12015",
        },
        {
          label: "#4 turnout (left)",
          kind: "turnout",
          length_mm: 254,
          qty: 2,
          product_code: "6-12017",
        },
      ],
    });

    expect(result.pdf).toBeInstanceOf(Uint8Array);
    expect(result.pdf.byteLength).toBeGreaterThan(1500);
    expect(result.total_pieces).toBe(8 + 12 + 2);
    // cover + 1 detail page + notes => 3 pages min
    expect(result.page_count).toBeGreaterThanOrEqual(3);

    const reloaded = await PDFDocument.load(result.pdf);
    expect(reloaded.getPageCount()).toBe(result.page_count);
    expect(reloaded.getTitle()).toContain("Stephen");
  });

  it("renders the same 3-row inventory on A4 with landscape page size", async () => {
    const result = await renderInventoryReport({
      paper_size: "a4",
      generated_at: "2026-05-05",
      rows: [
        { label: "Atlas straight", kind: "straight", length_mm: 152.4, qty: 4 },
        { label: "Atlas straight half", kind: "straight", length_mm: 76.2, qty: 4 },
        { label: "Atlas 22\" radius", kind: "curve", length_mm: null, radius_mm: 558.8, arc_degrees: 22.5, qty: 8 },
      ],
    });

    expect(result.pdf.byteLength).toBeGreaterThan(1500);
    const reloaded = await PDFDocument.load(result.pdf);
    // A4 landscape: 297mm wide x 210mm tall. Width converts via 72/25.4.
    const page0 = reloaded.getPage(0);
    const expectedWidthPt = 297 * (72 / 25.4);
    const expectedHeightPt = 210 * (72 / 25.4);
    expect(page0.getWidth()).toBeCloseTo(expectedWidthPt, 4);
    expect(page0.getHeight()).toBeCloseTo(expectedHeightPt, 4);
  });
});

describe("renderInventoryReport — pagination", () => {
  it("a 50-row inventory produces > 2 pages", async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      label: `Test piece ${i + 1}`,
      kind: i % 3 === 0 ? "curve" : "straight",
      length_mm: i % 3 === 0 ? null : 50 + i * 2,
      radius_mm: i % 3 === 0 ? 300 + i : null,
      arc_degrees: i % 3 === 0 ? 30 : null,
      qty: 1 + (i % 4),
      product_code: `SKU-${i + 1}`,
    }));

    const result = await renderInventoryReport({
      paper_size: "letter",
      rows,
    });

    // Cover + several detail pages + notes. 50 rows at ~7-8 rows per landscape
    // letter page should produce well more than 2 pages.
    expect(result.page_count).toBeGreaterThan(2);
    const reloaded = await PDFDocument.load(result.pdf);
    expect(reloaded.getPageCount()).toBe(result.page_count);
  });
});

describe("renderInventoryReport — defensive on rough data", () => {
  it("tolerates rows with null photos and null length_mm without throwing", async () => {
    const result = await renderInventoryReport({
      paper_size: "letter",
      rows: [
        // missing photo + null length
        {
          label: "mystery piece",
          length_mm: null,
          qty: 1,
          photo: null,
        },
        // photo set but null + missing kind/code
        {
          label: "another mystery",
          length_mm: null,
          qty: 0,
          photo: null,
        },
        // garbage photo data URL — should be skipped silently
        {
          label: "broken photo row",
          kind: "straight",
          length_mm: 100,
          qty: 3,
          photo: "data:image/jpeg;base64,not-actually-base64-jpeg-data!!!",
        },
        // non-jpeg data URL — should be skipped silently
        {
          label: "png photo row",
          kind: "straight",
          length_mm: 200,
          qty: 1,
          photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        },
      ],
    });

    expect(result.pdf).toBeInstanceOf(Uint8Array);
    expect(result.pdf.byteLength).toBeGreaterThan(1000);
    const reloaded = await PDFDocument.load(result.pdf);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(3);
  });

  it("handles an empty inventory by producing cover + notes only", async () => {
    const result = await renderInventoryReport({
      paper_size: "letter",
      rows: [],
    });
    expect(result.total_pieces).toBe(0);
    // Cover + notes (no detail pages because there are no rows).
    expect(result.page_count).toBe(2);
  });
});
