/**
 * Trackfit 1:1 cut-template renderer.
 *
 * Given a flex-track cut spec, produce a multi-page tiled PDF that, when
 * printed at 100% scale, places a "cut here" line at exactly target_length_mm
 * from the start of a flex piece of flex_nominal_length_mm.
 *
 * Why this is its own package:
 *  - It is the kind of code where a one-character bug (px vs pt, mm vs in)
 *    silently breaks the user's physical workflow. The forums will notice.
 *    Isolating it makes the unit-conversion math its own auditable surface.
 *  - It needs to run both server-side (Node, for batch print PDFs) and
 *    client-side (in the PWA, so the user can print without uploading).
 *    pdf-lib is the only mainstream lib that does both. jsPDF is browser-only.
 *
 * Design notes:
 *  - Coordinates are PDF points throughout. PDF points have origin at the
 *    bottom-left of the page. We convert mm -> points exactly once at the
 *    boundary (see MM_TO_PT). Internal arithmetic stays in points to match
 *    pdf-lib's API.
 *  - We tile along the X axis (the long axis of the flex piece). For most
 *    real cuts (≤914mm Peco / 760mm Atlas / 870mm Walthers) the strip fits
 *    on one or two landscape sheets. Y tiling would only matter if we ever
 *    drew curves at scale — out of scope here.
 *  - The "drawable strip" is a horizontal band centred vertically on each
 *    page. It is 40mm tall, plenty for a flex piece's full width plus
 *    annotation. The header lives above it, the calibration ruler below.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFFont,
  PDFPage,
} from "pdf-lib";
import type { CutTemplateInput, CutTemplateResult, PaperSize } from "./types.js";

/* ------------------------------------------------------------------ */
/* Unit conversion — the single source of truth.                       */
/*                                                                     */
/* PDF spec: 1 inch == 72 points.  ISO: 1 inch == 25.4 mm.             */
/* Therefore 1 mm == 72 / 25.4 points  ==  2.834645669… pt.            */
/* The renderer must NEVER hard-code derived numbers (e.g. "283.46").  */
/* All conversions go through these constants.                         */
/* ------------------------------------------------------------------ */

/** PDF points per inch — fixed by the PDF specification. */
export const PT_PER_INCH = 72;
/** Millimetres per inch — fixed by ISO. */
export const MM_PER_INCH = 25.4;
/** Millimetres → PDF points. Multiply mm by this to get pt. */
export const MM_TO_PT = PT_PER_INCH / MM_PER_INCH; // == 2.8346456692913385…
/** Convenience converter; prefer this over inline arithmetic at call sites. */
export const mmToPt = (mm: number): number => mm * MM_TO_PT;
/** Inches → PDF points, occasionally useful for the inches-display header. */
export const inToPt = (inches: number): number => inches * PT_PER_INCH;
/** Millimetres → inches, for the header readout. */
export const mmToIn = (mm: number): number => mm / MM_PER_INCH;

/* ------------------------------------------------------------------ */
/* Paper dimensions.                                                   */
/* ------------------------------------------------------------------ */

/** Paper sizes in millimetres in PORTRAIT orientation (width, height). */
const PAPER_MM: Record<PaperSize, { width: number; height: number }> = {
  letter: { width: 215.9, height: 279.4 }, // 8.5" x 11"
  a4: { width: 210, height: 297 },
};

/* ------------------------------------------------------------------ */
/* Layout constants — all in millimetres so the geometry is readable.  */
/* ------------------------------------------------------------------ */

/** Outer margin on every page edge (mm). Generous to survive printer nip. */
const PAGE_MARGIN_MM = 10;
/** Vertical space reserved at the top of every page for header text (mm). */
const HEADER_HEIGHT_MM = 18;
/** Vertical space at the bottom for the calibration ruler (mm). */
const RULER_HEIGHT_MM = 14;
/** Calibration ruler total length (mm). 100mm is the user's reference. */
const CALIBRATION_LENGTH_MM = 100;
/** Strip on which the flex piece is drawn — centred between header & ruler. */
const STRIP_HEIGHT_MM = 40;
/** Tick length on registration marks at page seams (mm). */
const REG_TICK_LEN_MM = 6;

/** Stroke widths in points; pdf-lib uses points for thickness. */
const STROKE_THIN = 0.4;
const STROKE_MED = 0.8;
const STROKE_HEAVY = 1.6;

/* ------------------------------------------------------------------ */
/* Public entrypoint.                                                  */
/* ------------------------------------------------------------------ */

/**
 * Render a 1:1 cut template PDF.
 *
 * The output is laid out so that, on the first page, the leftmost edge of the
 * drawable strip corresponds to the start of the flex piece (mm = 0). The
 * "cut here" line is drawn at target_length_mm. The flex piece outline runs
 * from 0 to flex_nominal_length_mm, tiling across pages as needed.
 */
export async function renderCutTemplate(
  input: CutTemplateInput
): Promise<CutTemplateResult> {
  if (!Number.isFinite(input.target_length_mm) || input.target_length_mm <= 0) {
    throw new Error("target_length_mm must be a positive finite number");
  }
  if (
    !Number.isFinite(input.flex_nominal_length_mm) ||
    input.flex_nominal_length_mm <= 0
  ) {
    throw new Error("flex_nominal_length_mm must be a positive finite number");
  }
  if (input.target_length_mm > input.flex_nominal_length_mm) {
    throw new Error(
      "target_length_mm cannot exceed flex_nominal_length_mm — you'd be extending, not cutting"
    );
  }

  const paperSize = input.paper_size;
  const paper = PAPER_MM[paperSize];

  // Landscape orientation by default. Flex pieces are long and skinny; rotating
  // the page maximises the printable strip width and minimises page count.
  const pageWidthMm = paper.height;
  const pageHeightMm = paper.width;

  const drawableWidthMm = pageWidthMm - 2 * PAGE_MARGIN_MM;
  // We need to fit the full flex piece outline across pages, but the cut line
  // is the only thing the user strictly needs. We tile until we've covered
  // flex_nominal_length_mm so the un-cut waste is also visible — the hobbyist
  // can decide to keep the offcut.
  const totalLengthMm = input.flex_nominal_length_mm;
  const pageCount = Math.max(1, Math.ceil(totalLengthMm / drawableWidthMm));

  const doc = await PDFDocument.create();
  doc.setTitle(`Trackfit cut template — ${input.track_label}`);
  doc.setCreator("Trackfit cut-templates");
  doc.setProducer("Trackfit cut-templates (pdf-lib)");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  const dateIso =
    input.date_iso ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
    const page = doc.addPage([mmToPt(pageWidthMm), mmToPt(pageHeightMm)]);
    const stripStartMm = pageIdx * drawableWidthMm;
    const stripEndMm = Math.min(
      stripStartMm + drawableWidthMm,
      totalLengthMm
    );

    drawHeader(page, fontBold, font, {
      pageWidthMm,
      pageHeightMm,
      pageIdx,
      pageCount,
      input,
      dateIso,
    });

    drawStrip(page, font, {
      pageWidthMm,
      pageHeightMm,
      stripStartMm,
      stripEndMm,
      input,
    });

    drawRegistrationMarks(page, font, {
      pageWidthMm,
      pageHeightMm,
      pageIdx,
      pageCount,
      stripStartMm,
      stripEndMm,
    });

    drawCalibrationRuler(page, font, fontMono, {
      pageWidthMm,
      pageHeightMm,
    });
  }

  const pdfBytes = await doc.save();

  return {
    pdf: pdfBytes,
    page_count: pageCount,
    paper_size: paperSize,
    target_length_mm: input.target_length_mm,
  };
}

/* ------------------------------------------------------------------ */
/* Drawing helpers.                                                    */
/* ------------------------------------------------------------------ */

interface PageGeom {
  pageWidthMm: number;
  pageHeightMm: number;
}

function drawHeader(
  page: PDFPage,
  fontBold: PDFFont,
  font: PDFFont,
  ctx: PageGeom & {
    pageIdx: number;
    pageCount: number;
    input: CutTemplateInput;
    dateIso: string;
  }
): void {
  const { pageWidthMm, pageHeightMm, pageIdx, pageCount, input, dateIso } = ctx;
  const baselineMm = pageHeightMm - PAGE_MARGIN_MM - 6;
  const titleMm = pageHeightMm - PAGE_MARGIN_MM - 1;

  const lengthIn = mmToIn(input.target_length_mm);
  const titleText = `Trackfit cut template — ${input.track_label}`;
  const detailText =
    `cut at ${input.target_length_mm.toFixed(2)} mm ` +
    `(${lengthIn.toFixed(3)} in) ` +
    `from ${input.flex_nominal_length_mm.toFixed(0)} mm flex piece` +
    `   ·   ${dateIso}` +
    `   ·   page ${pageIdx + 1} of ${pageCount}`;

  page.drawText(titleText, {
    x: mmToPt(PAGE_MARGIN_MM),
    y: mmToPt(titleMm) - 10, // pdf-lib's text y is the baseline
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  page.drawText(detailText, {
    x: mmToPt(PAGE_MARGIN_MM),
    y: mmToPt(baselineMm) - 8,
    size: 8.5,
    font,
    color: rgb(0.15, 0.15, 0.15),
  });

  // A horizontal rule under the header so the eye separates header from strip.
  const ruleYMm = pageHeightMm - PAGE_MARGIN_MM - HEADER_HEIGHT_MM + 1;
  page.drawLine({
    start: { x: mmToPt(PAGE_MARGIN_MM), y: mmToPt(ruleYMm) },
    end: {
      x: mmToPt(pageWidthMm - PAGE_MARGIN_MM),
      y: mmToPt(ruleYMm),
    },
    thickness: STROKE_THIN,
    color: rgb(0.5, 0.5, 0.5),
  });
}

function drawStrip(
  page: PDFPage,
  font: PDFFont,
  ctx: PageGeom & {
    stripStartMm: number;
    stripEndMm: number;
    input: CutTemplateInput;
  }
): void {
  const { pageWidthMm, pageHeightMm, stripStartMm, stripEndMm, input } = ctx;

  // Vertical placement: strip is centred between the bottom of the header
  // and the top of the calibration ruler band.
  const headerBottomMm = pageHeightMm - PAGE_MARGIN_MM - HEADER_HEIGHT_MM;
  const rulerTopMm = PAGE_MARGIN_MM + RULER_HEIGHT_MM;
  const midMm = (headerBottomMm + rulerTopMm) / 2;
  const stripTopMm = midMm + STRIP_HEIGHT_MM / 2;
  const stripBottomMm = midMm - STRIP_HEIGHT_MM / 2;

  // X mapping: the start of the strip on this page corresponds to
  // stripStartMm on the flex piece. So a flex-piece coordinate `m` maps to
  // page x = PAGE_MARGIN_MM + (m - stripStartMm).
  const pieceXMm = (m: number) => PAGE_MARGIN_MM + (m - stripStartMm);
  const drawableEndMm = pageWidthMm - PAGE_MARGIN_MM;

  // The flex piece outline — a rectangle from max(0, stripStartMm) to
  // stripEndMm, drawn 1:1 in the strip band.
  const outlineStartMm = Math.max(0, stripStartMm);
  const outlineEndMm = stripEndMm;
  if (outlineEndMm > outlineStartMm) {
    page.drawRectangle({
      x: mmToPt(pieceXMm(outlineStartMm)),
      y: mmToPt(stripBottomMm),
      width: mmToPt(outlineEndMm - outlineStartMm),
      height: mmToPt(STRIP_HEIGHT_MM),
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: STROKE_MED,
    });
  }

  // Centre line of the rail, mostly cosmetic so the user can eyeball alignment.
  page.drawLine({
    start: { x: mmToPt(pieceXMm(outlineStartMm)), y: mmToPt(midMm) },
    end: { x: mmToPt(pieceXMm(outlineEndMm)), y: mmToPt(midMm) },
    thickness: STROKE_THIN,
    color: rgb(0.7, 0.7, 0.7),
    dashArray: [2, 2],
  });

  // Major mm ticks every 10mm along the bottom edge of the strip.
  // We draw both 10mm minor and 100mm major ticks so the user can sanity-
  // check tile alignment with a ruler.
  const firstTick = Math.ceil(outlineStartMm / 10) * 10;
  for (let m = firstTick; m <= outlineEndMm; m += 10) {
    const isMajor = m % 100 === 0;
    const tickH = isMajor ? 4 : 2;
    page.drawLine({
      start: { x: mmToPt(pieceXMm(m)), y: mmToPt(stripBottomMm) },
      end: {
        x: mmToPt(pieceXMm(m)),
        y: mmToPt(stripBottomMm + tickH),
      },
      thickness: isMajor ? STROKE_MED : STROKE_THIN,
      color: rgb(0.3, 0.3, 0.3),
    });
    if (isMajor) {
      page.drawText(`${m}`, {
        x: mmToPt(pieceXMm(m)) + 1,
        y: mmToPt(stripBottomMm + tickH) + 1,
        size: 6.5,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
  }

  // The "cut here" line — the whole reason this PDF exists.
  // Heavy weight, full vertical extent of the strip, plus a tab label so
  // it can't be confused with a registration mark.
  const target = input.target_length_mm;
  if (target >= stripStartMm && target <= stripEndMm + 0.0001) {
    const xPt = mmToPt(pieceXMm(target));
    page.drawLine({
      start: { x: xPt, y: mmToPt(stripBottomMm - 4) },
      end: { x: xPt, y: mmToPt(stripTopMm + 4) },
      thickness: STROKE_HEAVY,
      color: rgb(0.85, 0.1, 0.1),
    });
    page.drawText("CUT HERE", {
      x: xPt + 2,
      y: mmToPt(stripTopMm + 1),
      size: 9,
      font,
      color: rgb(0.85, 0.1, 0.1),
    });
    page.drawText(`${target.toFixed(2)} mm`, {
      x: xPt + 2,
      y: mmToPt(stripTopMm - 4),
      size: 7,
      font,
      color: rgb(0.85, 0.1, 0.1),
    });
  }

  // Suppress unused-variable lint when target line falls off the page —
  // drawableEndMm is computed for future clipping logic; keep the name.
  void drawableEndMm;
}

function drawRegistrationMarks(
  page: PDFPage,
  font: PDFFont,
  ctx: PageGeom & {
    pageIdx: number;
    pageCount: number;
    stripStartMm: number;
    stripEndMm: number;
  }
): void {
  const {
    pageWidthMm,
    pageHeightMm,
    pageIdx,
    pageCount,
    stripStartMm,
    stripEndMm,
  } = ctx;

  // Draw L-shaped corner trim guides on every page. These are the user's
  // "cut the white border off, then tape" marks. 6mm legs.
  const corners: Array<[number, number, 1 | -1, 1 | -1]> = [
    [PAGE_MARGIN_MM, PAGE_MARGIN_MM, 1, 1],
    [pageWidthMm - PAGE_MARGIN_MM, PAGE_MARGIN_MM, -1, 1],
    [PAGE_MARGIN_MM, pageHeightMm - PAGE_MARGIN_MM, 1, -1],
    [
      pageWidthMm - PAGE_MARGIN_MM,
      pageHeightMm - PAGE_MARGIN_MM,
      -1,
      -1,
    ],
  ];
  for (const [xMm, yMm, dx, dy] of corners) {
    page.drawLine({
      start: { x: mmToPt(xMm), y: mmToPt(yMm) },
      end: { x: mmToPt(xMm + dx * REG_TICK_LEN_MM), y: mmToPt(yMm) },
      thickness: STROKE_MED,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: mmToPt(xMm), y: mmToPt(yMm) },
      end: { x: mmToPt(xMm), y: mmToPt(yMm + dy * REG_TICK_LEN_MM) },
      thickness: STROKE_MED,
      color: rgb(0, 0, 0),
    });
  }

  // Seam registration marks: a small filled circle and label at the
  // exact position of the right edge of THIS page's drawable area, and
  // the left edge of the NEXT page's drawable area, so the user can line
  // them up. We label both with the shared mm coordinate to remove any
  // ambiguity about which mark mates with which.
  const pieceXMm = (m: number) => PAGE_MARGIN_MM + (m - stripStartMm);

  if (pageIdx < pageCount - 1) {
    // right-edge seam
    const seamMm = stripEndMm;
    const xPt = mmToPt(pieceXMm(seamMm));
    drawSeamMark(page, font, xPt, mmToPt(pageHeightMm / 2), `mm ${seamMm.toFixed(0)}`);
  }
  if (pageIdx > 0) {
    // left-edge seam
    const seamMm = stripStartMm;
    const xPt = mmToPt(pieceXMm(seamMm));
    drawSeamMark(page, font, xPt, mmToPt(pageHeightMm / 2), `mm ${seamMm.toFixed(0)}`);
  }
}

function drawSeamMark(
  page: PDFPage,
  font: PDFFont,
  xPt: number,
  yPt: number,
  label: string
): void {
  // Crosshair plus circle — visually distinct from the cut line and from
  // corner trim guides so a hurried user does not confuse them.
  const r = mmToPt(2);
  page.drawCircle({
    x: xPt,
    y: yPt,
    size: r,
    borderColor: rgb(0, 0, 0),
    borderWidth: STROKE_MED,
  });
  page.drawLine({
    start: { x: xPt - r * 1.6, y: yPt },
    end: { x: xPt + r * 1.6, y: yPt },
    thickness: STROKE_THIN,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: xPt, y: yPt - r * 1.6 },
    end: { x: xPt, y: yPt + r * 1.6 },
    thickness: STROKE_THIN,
    color: rgb(0, 0, 0),
  });
  page.drawText(label, {
    x: xPt + r * 1.8,
    y: yPt - 3,
    size: 6.5,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawCalibrationRuler(
  page: PDFPage,
  font: PDFFont,
  fontMono: PDFFont,
  ctx: PageGeom
): void {
  const { pageWidthMm, pageHeightMm } = ctx;
  void pageHeightMm;

  // Place the calibration ruler at the bottom of the page, left-aligned with
  // the page margin. 100mm long. The label tells the user to verify with a
  // physical ruler — this is the printer-scaling sanity check.
  const rulerYMm = PAGE_MARGIN_MM + 8;
  const startXMm = PAGE_MARGIN_MM;
  const endXMm = startXMm + CALIBRATION_LENGTH_MM;

  if (endXMm > pageWidthMm - PAGE_MARGIN_MM) {
    // Should never happen on letter/A4 landscape but guard anyway.
    return;
  }

  page.drawLine({
    start: { x: mmToPt(startXMm), y: mmToPt(rulerYMm) },
    end: { x: mmToPt(endXMm), y: mmToPt(rulerYMm) },
    thickness: STROKE_MED,
    color: rgb(0, 0, 0),
  });
  // End caps.
  page.drawLine({
    start: { x: mmToPt(startXMm), y: mmToPt(rulerYMm - 2) },
    end: { x: mmToPt(startXMm), y: mmToPt(rulerYMm + 2) },
    thickness: STROKE_MED,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: mmToPt(endXMm), y: mmToPt(rulerYMm - 2) },
    end: { x: mmToPt(endXMm), y: mmToPt(rulerYMm + 2) },
    thickness: STROKE_MED,
    color: rgb(0, 0, 0),
  });
  // 10mm minor ticks.
  for (let m = 10; m < CALIBRATION_LENGTH_MM; m += 10) {
    const isMajor = m === 50;
    page.drawLine({
      start: { x: mmToPt(startXMm + m), y: mmToPt(rulerYMm) },
      end: {
        x: mmToPt(startXMm + m),
        y: mmToPt(rulerYMm + (isMajor ? 2 : 1.2)),
      },
      thickness: STROKE_THIN,
      color: rgb(0, 0, 0),
    });
  }
  page.drawText("0", {
    x: mmToPt(startXMm) - 1,
    y: mmToPt(rulerYMm - 6),
    size: 6.5,
    font: fontMono,
    color: rgb(0, 0, 0),
  });
  page.drawText("100 mm", {
    x: mmToPt(endXMm) - 12,
    y: mmToPt(rulerYMm - 6),
    size: 6.5,
    font: fontMono,
    color: rgb(0, 0, 0),
  });
  page.drawText("calibration ruler — measure with a physical ruler; if not 100 mm your printer is scaling", {
    x: mmToPt(startXMm),
    y: mmToPt(rulerYMm + 4),
    size: 6.5,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
}
