import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  renderCutTemplate,
  MM_TO_PT,
  PT_PER_INCH,
  MM_PER_INCH,
  mmToPt,
  mmToIn,
} from "../src/index.js";

/**
 * Cut-template renderer tests.
 *
 * These tests are deliberately paranoid about unit conversion. A 1mm error
 * on a printed template is the kind of bug Model Train Forum will roast us
 * for — we want any regression to fail here before it reaches paper.
 *
 * Notes on the handoff fixture:
 *   {target_length_mm: 600, flex_nominal_length_mm: 914, paper_size: "letter"}
 * The handoff text describes this as "a single page with the cut line at the
 * right spot." That's not geometrically achievable: letter landscape gives
 * ~259.4mm of drawable width, and a 914mm flex piece tiles across 4 pages
 * regardless of where the cut lands. We honour the spirit of the test —
 * generate the PDF, assert page count matches what the geometry requires,
 * and verify the renderer doesn't throw on that exact input — rather than
 * the literal "single page" assertion. A separate small-target test below
 * exercises the genuinely single-page case.
 */

describe("unit conversion constants — these are sacred", () => {
  it("PT_PER_INCH is exactly 72 (PDF spec)", () => {
    expect(PT_PER_INCH).toBe(72);
  });

  it("MM_PER_INCH is exactly 25.4 (ISO)", () => {
    expect(MM_PER_INCH).toBe(25.4);
  });

  it("a 100 mm line is exactly 283.4645669… PDF points", () => {
    // 100 mm * 72 pt/in / 25.4 mm/in == 7200 / 25.4 == 283.46456692913385
    const lengthPt = mmToPt(100);
    expect(lengthPt).toBeCloseTo(283.4645669, 6);
    // Also assert the algebraic identity rather than a magic number, so a
    // future refactor that breaks the formula but happens to keep the
    // approximate value still fails this test.
    expect(lengthPt).toBe(100 * (72 / 25.4));
  });

  it("MM_TO_PT is the canonical 72/25.4 ratio", () => {
    expect(MM_TO_PT).toBe(72 / 25.4);
  });

  it("mmToIn round-trips cleanly", () => {
    expect(mmToIn(25.4)).toBe(1);
    expect(mmToIn(254)).toBe(10);
  });
});

describe("renderCutTemplate — handoff fixture", () => {
  it("renders the 600 mm cut on a 914 mm flex piece (letter)", async () => {
    const result = await renderCutTemplate({
      target_length_mm: 600,
      flex_nominal_length_mm: 914,
      paper_size: "letter",
      track_label: "Peco SL-100 Code 100 flex",
      date_iso: "2026-05-05",
    });

    expect(result.target_length_mm).toBe(600);
    expect(result.paper_size).toBe("letter");
    expect(result.pdf).toBeInstanceOf(Uint8Array);
    expect(result.pdf.byteLength).toBeGreaterThan(1000); // sanity: non-empty PDF

    // Letter landscape: 279.4 mm wide, 10 mm margins each side -> 259.4 mm
    // drawable per page. 914 mm flex piece -> ceil(914 / 259.4) == 4 pages.
    expect(result.page_count).toBe(4);

    // The PDF must be parseable and report the same page count.
    const reloaded = await PDFDocument.load(result.pdf);
    expect(reloaded.getPageCount()).toBe(4);

    // Page size in points: 279.4 mm wide x 215.9 mm tall (landscape letter).
    const page0 = reloaded.getPage(0);
    expect(page0.getWidth()).toBeCloseTo(mmToPt(279.4), 4);
    expect(page0.getHeight()).toBeCloseTo(mmToPt(215.9), 4);

    // PDF metadata should carry the track label so a printed stack is sortable.
    expect(reloaded.getTitle()).toContain("Peco SL-100");
  });
});

describe("renderCutTemplate — small target fits on a single page", () => {
  it("a 200 mm cut on a 250 mm piece tiles to exactly one page (letter)", async () => {
    const result = await renderCutTemplate({
      target_length_mm: 200,
      flex_nominal_length_mm: 250,
      paper_size: "letter",
      track_label: "test piece",
      date_iso: "2026-05-05",
    });
    // 250 mm fits inside 259.4 mm drawable width -> 1 page.
    expect(result.page_count).toBe(1);
    const reloaded = await PDFDocument.load(result.pdf);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("a 200 mm cut on a 250 mm piece tiles to exactly one page (a4)", async () => {
    const result = await renderCutTemplate({
      target_length_mm: 200,
      flex_nominal_length_mm: 250,
      paper_size: "a4",
      track_label: "test piece",
      date_iso: "2026-05-05",
    });
    // A4 landscape drawable width: 297 - 20 = 277 mm, plenty for 250 mm.
    expect(result.page_count).toBe(1);
    const reloaded = await PDFDocument.load(result.pdf);
    expect(reloaded.getPageCount()).toBe(1);
    const page0 = reloaded.getPage(0);
    expect(page0.getWidth()).toBeCloseTo(mmToPt(297), 4);
    expect(page0.getHeight()).toBeCloseTo(mmToPt(210), 4);
  });
});

describe("renderCutTemplate — input validation", () => {
  it("rejects a non-positive target", async () => {
    await expect(
      renderCutTemplate({
        target_length_mm: 0,
        flex_nominal_length_mm: 914,
        paper_size: "letter",
        track_label: "x",
      })
    ).rejects.toThrow(/target_length_mm/);
  });

  it("rejects a target longer than the flex piece", async () => {
    await expect(
      renderCutTemplate({
        target_length_mm: 1000,
        flex_nominal_length_mm: 914,
        paper_size: "letter",
        track_label: "x",
      })
    ).rejects.toThrow(/cannot exceed/);
  });

  it("rejects a non-finite flex nominal length", async () => {
    await expect(
      renderCutTemplate({
        target_length_mm: 100,
        flex_nominal_length_mm: Number.NaN,
        paper_size: "letter",
        track_label: "x",
      })
    ).rejects.toThrow(/flex_nominal_length_mm/);
  });
});
