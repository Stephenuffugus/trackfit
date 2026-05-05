/**
 * Trackfit inventory report renderer.
 *
 * Produces an "insurance-grade" PDF documenting a user's track inventory.
 * The strategy doc (§4.2) flags this as a real B2B revenue stream:
 * collectors with valuable collections want a paper record they can hand
 * to an insurer, an estate planner, or simply file in a binder.
 *
 * Why this shares a package with the cut-template renderer:
 *  - Both are pdf-lib jobs that must run in Node (CI/server) and the
 *    browser (PWA download). Co-locating them keeps the embedded font
 *    setup and the millimetre/point conversion math in one place.
 *  - Both face the same audience: an older hobbyist who values calm,
 *    readable layouts over flashy chrome. The visual language carries.
 *
 * Hard rules in here that future maintainers should respect:
 *  - StandardFonts only — no runtime font fetches. Times Roman Bold is
 *    pdf-lib's nearest stand-in for Fraunces; Helvetica for body;
 *    Courier for technical fields.
 *  - Photos are embedded via embedJpg ONLY. Other formats (or corrupt
 *    JPEGs) are skipped silently rather than crashing a 50-row report.
 *  - Landscape by default — the column count is wider than tall.
 *  - 15mm outer margins, generous for a printed binder.
 */

import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { mmToPt, mmToIn } from "./render.js";
import type { PaperSize } from "./types.js";

/* ------------------------------------------------------------------ */
/* Public types.                                                       */
/* ------------------------------------------------------------------ */

export interface InventoryReportRow {
  label: string;
  kind?: string;
  length_mm: number | null;
  radius_mm?: number | null;
  arc_degrees?: number | null;
  qty: number;
  /** base64 data URL or null. Only JPEG data URLs are embedded. */
  photo?: string | null;
  /** optional product code for the catalog column */
  product_code?: string | null;
}

export interface InventoryReportInput {
  /** human-readable owner / collection name. Goes in the header. */
  owner_label?: string;
  /** ISO date the report was generated; defaults to today */
  generated_at?: string;
  /** the rows the user owns */
  rows: InventoryReportRow[];
  paper_size: PaperSize;
}

export interface InventoryReportResult {
  pdf: Uint8Array;
  page_count: number;
  total_pieces: number;
}

/* ------------------------------------------------------------------ */
/* Layout constants — millimetres throughout.                          */
/* ------------------------------------------------------------------ */

/** Outer margin on every page edge (mm). 15mm per the spec. */
const PAGE_MARGIN_MM = 15;
/** Reserved header band on every detail page (mm). */
const HEADER_BAND_MM = 16;
/** Reserved footer band on every page (mm). */
const FOOTER_BAND_MM = 10;
/** Detail-row height (mm). Tall enough to fit a ~30mm-wide thumbnail. */
const ROW_HEIGHT_MM = 24;
/** Thumbnail target width (mm). Spec calls for "~30mm wide". */
const THUMB_WIDTH_MM = 28;
/** Thumbnail max height (mm) — must fit inside ROW_HEIGHT_MM minus padding. */
const THUMB_MAX_HEIGHT_MM = ROW_HEIGHT_MM - 4;

/** Soft cap on row count to keep PDF size sane. */
const MAX_ROWS = 2000;

/** Paper sizes in millimetres in PORTRAIT orientation (width, height). */
const PAPER_MM: Record<PaperSize, { width: number; height: number }> = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
};

/** Order in which kinds are grouped. Anything else falls into "other". */
const KIND_ORDER: ReadonlyArray<string> = [
  "straight",
  "fitter",
  "flex",
  "curve",
  "turnout",
  "crossing",
  "other",
];

/* ------------------------------------------------------------------ */
/* Public entrypoint.                                                  */
/* ------------------------------------------------------------------ */

/**
 * Render an inventory report PDF.
 *
 * Layout:
 *  - Page 1: cover with title, subhead, summary table.
 *  - Pages 2..N-1: detail rows, grouped by kind, paginated when full.
 *  - Last page: notes section (provenance + handwriting rules).
 *
 * The page count returned is whatever pdf-lib produced; callers can
 * surface it in the UI.
 */
export async function renderInventoryReport(
  input: InventoryReportInput,
): Promise<InventoryReportResult> {
  const paper = PAPER_MM[input.paper_size];
  // Landscape — table columns are wider than tall.
  const pageWidthMm = paper.height;
  const pageHeightMm = paper.width;

  // Hard-cap row count. A 2000-row PDF is already heavy; beyond that the
  // user almost certainly wants a CSV export, not a printed binder.
  const rows = input.rows.slice(0, MAX_ROWS);

  const generatedAt =
    input.generated_at ?? new Date().toISOString().slice(0, 10);
  const ownerLabel = input.owner_label?.trim() || "this collection";

  const doc = await PDFDocument.create();
  doc.setTitle(`Trackfit inventory report — ${ownerLabel}`);
  doc.setCreator("Trackfit cut-templates");
  doc.setProducer("Trackfit cut-templates (pdf-lib)");

  const fontBody = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  const totals = computeTotals(rows);

  // -------- Page 1: cover -------------------------------------------------
  const coverPage = doc.addPage([mmToPt(pageWidthMm), mmToPt(pageHeightMm)]);
  drawCover(coverPage, fontBold, fontBody, fontMono, {
    pageWidthMm,
    pageHeightMm,
    ownerLabel,
    generatedAt,
    totals,
  });

  // -------- Pages 2..N-1: detail rows ------------------------------------
  // Group + sort so a glance at a printed binder reveals structure.
  const sorted = sortAndGroup(rows);

  // Pre-embed photo bytes; embedJpg can throw on malformed data so we
  // wrap each call individually and skip failed photos rather than aborting
  // the whole report.
  const embeddedPhotos = await embedPhotosSafely(doc, sorted);

  // Available vertical space for rows on a detail page (mm).
  const detailRowsTopMm = pageHeightMm - PAGE_MARGIN_MM - HEADER_BAND_MM;
  const detailRowsBottomMm = PAGE_MARGIN_MM + FOOTER_BAND_MM;
  const rowsPerPage = Math.max(
    1,
    Math.floor((detailRowsTopMm - detailRowsBottomMm) / ROW_HEIGHT_MM),
  );

  const detailPages: PDFPage[] = [];
  for (let i = 0; i < sorted.length; i += rowsPerPage) {
    const slice = sorted.slice(i, i + rowsPerPage);
    const photos = embeddedPhotos.slice(i, i + rowsPerPage);
    const page = doc.addPage([mmToPt(pageWidthMm), mmToPt(pageHeightMm)]);
    detailPages.push(page);
    drawDetailHeader(page, fontBold, fontBody, {
      pageWidthMm,
      pageHeightMm,
      ownerLabel,
      generatedAt,
    });
    drawDetailTable(page, fontBody, fontMono, fontBold, {
      pageWidthMm,
      pageHeightMm,
      rows: slice,
      photos,
      topMm: detailRowsTopMm,
      bottomMm: detailRowsBottomMm,
    });
  }

  // -------- Last page: notes ---------------------------------------------
  const notesPage = doc.addPage([mmToPt(pageWidthMm), mmToPt(pageHeightMm)]);
  drawNotesPage(notesPage, fontBold, fontBody, fontMono, {
    pageWidthMm,
    pageHeightMm,
  });

  // Footers reference the final page count — draw them after every page
  // exists so "page X of N" is correct.
  const totalPageCount = doc.getPageCount();
  for (let i = 0; i < totalPageCount; i++) {
    const page = doc.getPage(i);
    drawFooter(page, fontBody, {
      pageWidthMm,
      pageNumber: i + 1,
      totalPageCount,
    });
  }

  const pdf = await doc.save();

  return {
    pdf,
    page_count: totalPageCount,
    total_pieces: totals.totalPieces,
  };
}

/* ------------------------------------------------------------------ */
/* Totals + grouping.                                                  */
/* ------------------------------------------------------------------ */

interface Totals {
  totalPieces: number;
  totalTypes: number;
  totalStraightMm: number;
  totalCurveDegrees: number;
  turnoutCount: number;
  crossingCount: number;
}

function computeTotals(rows: InventoryReportRow[]): Totals {
  let totalPieces = 0;
  let totalStraightMm = 0;
  let totalCurveDegrees = 0;
  let turnoutCount = 0;
  let crossingCount = 0;

  for (const r of rows) {
    const qty = Number.isFinite(r.qty) ? Math.max(0, Math.floor(r.qty)) : 0;
    totalPieces += qty;
    const kind = normalizeKind(r.kind);
    if (kind === "straight" || kind === "fitter" || kind === "flex") {
      if (typeof r.length_mm === "number" && Number.isFinite(r.length_mm)) {
        totalStraightMm += r.length_mm * qty;
      }
    } else if (kind === "curve") {
      if (
        typeof r.arc_degrees === "number" &&
        Number.isFinite(r.arc_degrees)
      ) {
        totalCurveDegrees += r.arc_degrees * qty;
      }
    } else if (kind === "turnout") {
      turnoutCount += qty;
    } else if (kind === "crossing") {
      crossingCount += qty;
    }
  }

  return {
    totalPieces,
    totalTypes: rows.length,
    totalStraightMm,
    totalCurveDegrees,
    turnoutCount,
    crossingCount,
  };
}

function normalizeKind(kind: string | undefined): string {
  if (!kind) return "other";
  const k = kind.toLowerCase();
  if (KIND_ORDER.includes(k)) return k;
  return "other";
}

function sortAndGroup(rows: InventoryReportRow[]): InventoryReportRow[] {
  const buckets = new Map<string, InventoryReportRow[]>();
  for (const r of rows) {
    const k = normalizeKind(r.kind);
    let arr = buckets.get(k);
    if (!arr) {
      arr = [];
      buckets.set(k, arr);
    }
    arr.push(r);
  }
  // Sort each bucket by length (curves by radius). Null lengths sink to the
  // end so a "—" row doesn't elbow real data out of the way.
  const lengthKey = (r: InventoryReportRow): number => {
    const k = normalizeKind(r.kind);
    if (k === "curve") {
      return typeof r.radius_mm === "number" ? r.radius_mm : Number.MAX_VALUE;
    }
    return typeof r.length_mm === "number" ? r.length_mm : Number.MAX_VALUE;
  };
  for (const arr of buckets.values()) {
    arr.sort((a, b) => lengthKey(a) - lengthKey(b));
  }
  const out: InventoryReportRow[] = [];
  for (const k of KIND_ORDER) {
    const arr = buckets.get(k);
    if (arr) out.push(...arr);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Photo embedding — safe variant that never throws.                   */
/* ------------------------------------------------------------------ */

async function embedPhotosSafely(
  doc: PDFDocument,
  rows: InventoryReportRow[],
): Promise<Array<PDFImage | null>> {
  const out: Array<PDFImage | null> = [];
  for (const r of rows) {
    const url = r.photo;
    if (typeof url !== "string" || url.length === 0) {
      out.push(null);
      continue;
    }
    // We only support JPEG data URLs per the spec. Anything else (PNG, raw
    // bytes, http URL) is skipped silently — the goal is "don't crash a
    // 50-row report on one bad photo."
    if (!url.startsWith("data:image/jpeg") && !url.startsWith("data:image/jpg")) {
      out.push(null);
      continue;
    }
    const commaIdx = url.indexOf(",");
    if (commaIdx < 0) {
      out.push(null);
      continue;
    }
    const b64 = url.slice(commaIdx + 1);
    try {
      const bytes = base64ToBytes(b64);
      const img = await doc.embedJpg(bytes);
      out.push(img);
    } catch {
      // Malformed JPEG, truncated payload, etc. Skip rather than crash.
      out.push(null);
    }
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  // Works in both Node and the browser. atob lives on the global in modern
  // Node (>=16) and in every browser. Buffer would be Node-only.
  const bin =
    typeof atob === "function"
      ? atob(b64)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ */
/* Drawing — cover page.                                               */
/* ------------------------------------------------------------------ */

function drawCover(
  page: PDFPage,
  fontBold: PDFFont,
  fontBody: PDFFont,
  fontMono: PDFFont,
  ctx: {
    pageWidthMm: number;
    pageHeightMm: number;
    ownerLabel: string;
    generatedAt: string;
    totals: Totals;
  },
): void {
  const { pageWidthMm, pageHeightMm, ownerLabel, generatedAt, totals } = ctx;

  // Title — generous size, near the top.
  const titleYMm = pageHeightMm - PAGE_MARGIN_MM - 14;
  page.drawText("Trackfit — Inventory Report", {
    x: mmToPt(PAGE_MARGIN_MM),
    y: mmToPt(titleYMm),
    size: 28,
    font: fontBold,
    color: rgb(0.05, 0.07, 0.18),
  });

  const subYMm = titleYMm - 10;
  page.drawText(`Prepared for ${ownerLabel} on ${generatedAt}`, {
    x: mmToPt(PAGE_MARGIN_MM),
    y: mmToPt(subYMm),
    size: 12,
    font: fontBody,
    color: rgb(0.2, 0.2, 0.25),
  });

  // Horizontal rule separating header from summary.
  const ruleYMm = subYMm - 8;
  page.drawLine({
    start: { x: mmToPt(PAGE_MARGIN_MM), y: mmToPt(ruleYMm) },
    end: {
      x: mmToPt(pageWidthMm - PAGE_MARGIN_MM),
      y: mmToPt(ruleYMm),
    },
    thickness: 0.6,
    color: rgb(0.55, 0.55, 0.6),
  });

  // Summary table — two-column "label : value" layout. Labels in body,
  // values in mono so the eye lines them up.
  const labelXMm = PAGE_MARGIN_MM;
  const valueXMm = PAGE_MARGIN_MM + 90;
  const lineH = 9;
  let yMm = ruleYMm - 14;

  page.drawText("Summary", {
    x: mmToPt(labelXMm),
    y: mmToPt(yMm),
    size: 14,
    font: fontBold,
    color: rgb(0.05, 0.07, 0.18),
  });
  yMm -= lineH + 2;

  const totalIn = mmToIn(totals.totalStraightMm);
  const summaryRows: Array<[string, string]> = [
    ["Total pieces", String(totals.totalPieces)],
    ["Total piece types", String(totals.totalTypes)],
    [
      "Total straight length",
      `${formatMm(totals.totalStraightMm)} mm  (${totalIn.toFixed(2)} in)`,
    ],
    ["Total curve sweep", `${formatDegrees(totals.totalCurveDegrees)}°`],
    ["Turnout count", String(totals.turnoutCount)],
    ["Crossing count", String(totals.crossingCount)],
  ];

  for (const [label, value] of summaryRows) {
    page.drawText(label, {
      x: mmToPt(labelXMm),
      y: mmToPt(yMm),
      size: 11,
      font: fontBody,
      color: rgb(0.15, 0.15, 0.2),
    });
    page.drawText(value, {
      x: mmToPt(valueXMm),
      y: mmToPt(yMm),
      size: 11,
      font: fontMono,
      color: rgb(0.05, 0.07, 0.18),
    });
    yMm -= lineH;
  }
}

/* ------------------------------------------------------------------ */
/* Drawing — detail page header / table.                               */
/* ------------------------------------------------------------------ */

function drawDetailHeader(
  page: PDFPage,
  fontBold: PDFFont,
  fontBody: PDFFont,
  ctx: {
    pageWidthMm: number;
    pageHeightMm: number;
    ownerLabel: string;
    generatedAt: string;
  },
): void {
  const { pageWidthMm, pageHeightMm, ownerLabel, generatedAt } = ctx;
  const titleYMm = pageHeightMm - PAGE_MARGIN_MM - 6;
  page.drawText("Inventory detail", {
    x: mmToPt(PAGE_MARGIN_MM),
    y: mmToPt(titleYMm),
    size: 13,
    font: fontBold,
    color: rgb(0.05, 0.07, 0.18),
  });
  // Right-aligned subhead — owner + date in body.
  const sub = `${ownerLabel}  ·  ${generatedAt}`;
  const subWidth = fontBody.widthOfTextAtSize(sub, 9);
  page.drawText(sub, {
    x: mmToPt(pageWidthMm - PAGE_MARGIN_MM) - subWidth,
    y: mmToPt(titleYMm + 1),
    size: 9,
    font: fontBody,
    color: rgb(0.3, 0.3, 0.35),
  });

  // Rule under the header band.
  const ruleYMm = pageHeightMm - PAGE_MARGIN_MM - HEADER_BAND_MM + 2;
  page.drawLine({
    start: { x: mmToPt(PAGE_MARGIN_MM), y: mmToPt(ruleYMm) },
    end: {
      x: mmToPt(pageWidthMm - PAGE_MARGIN_MM),
      y: mmToPt(ruleYMm),
    },
    thickness: 0.4,
    color: rgb(0.6, 0.6, 0.65),
  });
}

interface ColLayout {
  /** column x-origin (mm from left edge) */
  xMm: number;
  /** column width (mm) */
  wMm: number;
  /** display heading */
  heading: string;
  /** "left" | "right" alignment */
  align: "left" | "right";
}

function buildColumns(pageWidthMm: number): {
  photo: ColLayout;
  label: ColLayout;
  kind: ColLayout;
  dim: ColLayout;
  code: ColLayout;
  qty: ColLayout;
  subtotal: ColLayout;
} {
  const drawableMm = pageWidthMm - 2 * PAGE_MARGIN_MM;
  // Hand-tuned widths, summing to drawableMm. Photo is largest because the
  // user navigates the printout visually first.
  const photoW = 32;
  const qtyW = 14;
  const subtotalW = 32;
  const codeW = 32;
  const kindW = 20;
  const dimW = 38;
  const labelW = drawableMm - (photoW + qtyW + subtotalW + codeW + kindW + dimW);

  let cursor = PAGE_MARGIN_MM;
  const make = (
    w: number,
    heading: string,
    align: "left" | "right",
  ): ColLayout => {
    const col: ColLayout = { xMm: cursor, wMm: w, heading, align };
    cursor += w;
    return col;
  };
  return {
    photo: make(photoW, "Photo", "left"),
    label: make(labelW, "Label", "left"),
    kind: make(kindW, "Kind", "left"),
    dim: make(dimW, "Dimensions", "left"),
    code: make(codeW, "Code", "left"),
    qty: make(qtyW, "Qty", "right"),
    subtotal: make(subtotalW, "Subtotal", "right"),
  };
}

function drawDetailTable(
  page: PDFPage,
  fontBody: PDFFont,
  fontMono: PDFFont,
  fontBold: PDFFont,
  ctx: {
    pageWidthMm: number;
    pageHeightMm: number;
    rows: InventoryReportRow[];
    photos: Array<PDFImage | null>;
    topMm: number;
    bottomMm: number;
  },
): void {
  const { pageWidthMm, rows, photos, topMm } = ctx;
  const cols = buildColumns(pageWidthMm);
  const colArr = [cols.photo, cols.label, cols.kind, cols.dim, cols.code, cols.qty, cols.subtotal];

  // Column headings — bold, just below the rule.
  const headingYMm = topMm - 4;
  for (const c of colArr) {
    drawColText(page, fontBold, c, headingYMm, c.heading, 9, rgb(0.1, 0.1, 0.15));
  }

  // Separator under headings.
  const sepYMm = headingYMm - 2;
  page.drawLine({
    start: { x: mmToPt(PAGE_MARGIN_MM), y: mmToPt(sepYMm) },
    end: {
      x: mmToPt(pageWidthMm - PAGE_MARGIN_MM),
      y: mmToPt(sepYMm),
    },
    thickness: 0.4,
    color: rgb(0.4, 0.4, 0.45),
  });

  let rowTopMm = sepYMm - 2;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const photo = photos[i] ?? null;
    drawRow(page, fontBody, fontMono, cols, row, photo, rowTopMm);
    rowTopMm -= ROW_HEIGHT_MM;
  }
}

function drawColText(
  page: PDFPage,
  font: PDFFont,
  col: ColLayout,
  yMm: number,
  text: string,
  size: number,
  color: ReturnType<typeof rgb>,
): void {
  if (col.align === "left") {
    page.drawText(text, {
      x: mmToPt(col.xMm),
      y: mmToPt(yMm),
      size,
      font,
      color,
    });
  } else {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: mmToPt(col.xMm + col.wMm) - w - 2, // 2pt nudge inside the right edge
      y: mmToPt(yMm),
      size,
      font,
      color,
    });
  }
}

function drawRow(
  page: PDFPage,
  fontBody: PDFFont,
  fontMono: PDFFont,
  cols: ReturnType<typeof buildColumns>,
  row: InventoryReportRow,
  photo: PDFImage | null,
  rowTopMm: number,
): void {
  const rowMidMm = rowTopMm - ROW_HEIGHT_MM / 2;
  const textBaselineMm = rowMidMm - 1.2;

  // Photo cell — fit inside (THUMB_WIDTH_MM x THUMB_MAX_HEIGHT_MM) preserving
  // aspect ratio. If no photo, draw a subtle dashed placeholder so the eye
  // still finds the row's left anchor.
  const photoBoxXMm = cols.photo.xMm + 1;
  const photoBoxYMm = rowTopMm - ROW_HEIGHT_MM + 2;
  const photoBoxWMm = THUMB_WIDTH_MM;
  const photoBoxHMm = THUMB_MAX_HEIGHT_MM;

  if (photo) {
    const aspect = photo.width / photo.height;
    let drawWMm = photoBoxWMm;
    let drawHMm = drawWMm / aspect;
    if (drawHMm > photoBoxHMm) {
      drawHMm = photoBoxHMm;
      drawWMm = drawHMm * aspect;
    }
    const offsetXMm = photoBoxXMm + (photoBoxWMm - drawWMm) / 2;
    const offsetYMm = photoBoxYMm + (photoBoxHMm - drawHMm) / 2;
    page.drawImage(photo, {
      x: mmToPt(offsetXMm),
      y: mmToPt(offsetYMm),
      width: mmToPt(drawWMm),
      height: mmToPt(drawHMm),
    });
  } else {
    // Dashed placeholder — calm grey, no exclamation marks.
    page.drawRectangle({
      x: mmToPt(photoBoxXMm),
      y: mmToPt(photoBoxYMm),
      width: mmToPt(photoBoxWMm),
      height: mmToPt(photoBoxHMm),
      borderColor: rgb(0.75, 0.75, 0.78),
      borderWidth: 0.4,
      borderDashArray: [2, 2],
    });
  }

  // Label — body font, may need to truncate to fit column.
  const label = clipToWidth(fontBody, row.label || "(unnamed)", 10, cols.label.wMm - 2);
  drawColText(page, fontBody, cols.label, textBaselineMm, label, 10, rgb(0.05, 0.07, 0.18));

  // Kind — small caps style via uppercase, body font.
  const kindText = (row.kind ?? "—").toString();
  drawColText(page, fontBody, cols.kind, textBaselineMm, kindText, 9, rgb(0.25, 0.25, 0.3));

  // Dimensions — straights show length; curves show radius + arc; null shows "—".
  const dim = formatDimension(row);
  drawColText(page, fontMono, cols.dim, textBaselineMm, dim, 9, rgb(0.1, 0.1, 0.15));

  // Product code — mono so SKUs line up.
  const code = row.product_code ? row.product_code.toString() : "—";
  drawColText(
    page,
    fontMono,
    cols.code,
    textBaselineMm,
    clipToWidth(fontMono, code, 9, cols.code.wMm - 2),
    9,
    rgb(0.25, 0.25, 0.3),
  );

  // Qty — right-aligned, mono.
  const qty = Number.isFinite(row.qty) ? Math.max(0, Math.floor(row.qty)) : 0;
  drawColText(page, fontMono, cols.qty, textBaselineMm, String(qty), 9, rgb(0.05, 0.07, 0.18));

  // Subtotal length (mm) — only meaningful for straights/fitters/flex.
  const subtotal = formatSubtotal(row, qty);
  drawColText(page, fontMono, cols.subtotal, textBaselineMm, subtotal, 9, rgb(0.05, 0.07, 0.18));
}

function formatDimension(row: InventoryReportRow): string {
  const kind = normalizeKind(row.kind);
  if (kind === "curve") {
    const r =
      typeof row.radius_mm === "number" && Number.isFinite(row.radius_mm)
        ? `${formatMm(row.radius_mm)}r`
        : "—r";
    const a =
      typeof row.arc_degrees === "number" && Number.isFinite(row.arc_degrees)
        ? `${formatDegrees(row.arc_degrees)}°`
        : "—°";
    return `${r} × ${a}`;
  }
  if (typeof row.length_mm === "number" && Number.isFinite(row.length_mm)) {
    return `${formatMm(row.length_mm)} mm`;
  }
  return "—";
}

function formatSubtotal(row: InventoryReportRow, qty: number): string {
  const kind = normalizeKind(row.kind);
  if (kind === "straight" || kind === "fitter" || kind === "flex") {
    if (typeof row.length_mm === "number" && Number.isFinite(row.length_mm)) {
      return `${formatMm(row.length_mm * qty)} mm`;
    }
  }
  return "—";
}

function formatMm(mm: number): string {
  // Two decimals when small, one when in the 100s, integer above 1000 — keeps
  // the column visually calm without losing useful precision.
  const abs = Math.abs(mm);
  if (abs >= 1000) return mm.toFixed(0);
  if (abs >= 100) return mm.toFixed(1);
  return mm.toFixed(2);
}

function formatDegrees(deg: number): string {
  if (Math.abs(deg) >= 100) return deg.toFixed(0);
  return deg.toFixed(1);
}

function clipToWidth(
  font: PDFFont,
  text: string,
  size: number,
  maxMm: number,
): string {
  const maxPt = mmToPt(maxMm);
  if (font.widthOfTextAtSize(text, size) <= maxPt) return text;
  // Greedy backtrack with an ellipsis. Costs at most O(text.length) widthOf
  // calls; row counts are bounded so this is fine.
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > maxPt) {
    s = s.slice(0, -1);
  }
  return s + "…";
}

/* ------------------------------------------------------------------ */
/* Drawing — notes / last page.                                        */
/* ------------------------------------------------------------------ */

function drawNotesPage(
  page: PDFPage,
  fontBold: PDFFont,
  fontBody: PDFFont,
  fontMono: PDFFont,
  ctx: { pageWidthMm: number; pageHeightMm: number },
): void {
  const { pageWidthMm, pageHeightMm } = ctx;

  const titleYMm = pageHeightMm - PAGE_MARGIN_MM - 8;
  page.drawText("Notes", {
    x: mmToPt(PAGE_MARGIN_MM),
    y: mmToPt(titleYMm),
    size: 18,
    font: fontBold,
    color: rgb(0.05, 0.07, 0.18),
  });

  // Provenance line — small mono so the user knows it's machine-stamped.
  const provYMm = titleYMm - 8;
  page.drawText(
    "Generated by Trackfit (trackfit.stevieweedseed.com). Dimensions are catalog values, not measured. Photos are stored on-device only.",
    {
      x: mmToPt(PAGE_MARGIN_MM),
      y: mmToPt(provYMm),
      size: 8,
      font: fontMono,
      color: rgb(0.35, 0.35, 0.4),
      maxWidth: mmToPt(pageWidthMm - 2 * PAGE_MARGIN_MM),
    },
  );

  // Handwriting rules — 8 lines, nicely spaced, leaving room for the footer.
  const writeStartYMm = provYMm - 14;
  const ruleSpacingMm = 14;
  const numRules = 8;
  for (let i = 0; i < numRules; i++) {
    const yMm = writeStartYMm - i * ruleSpacingMm;
    if (yMm < PAGE_MARGIN_MM + FOOTER_BAND_MM + 6) break;
    page.drawLine({
      start: { x: mmToPt(PAGE_MARGIN_MM), y: mmToPt(yMm) },
      end: {
        x: mmToPt(pageWidthMm - PAGE_MARGIN_MM),
        y: mmToPt(yMm),
      },
      thickness: 0.3,
      color: rgb(0.65, 0.65, 0.7),
    });
  }
  void fontBody; // reserved if we add hint text under the rules later
}

/* ------------------------------------------------------------------ */
/* Drawing — footer (every page).                                      */
/* ------------------------------------------------------------------ */

function drawFooter(
  page: PDFPage,
  fontBody: PDFFont,
  ctx: {
    pageWidthMm: number;
    pageNumber: number;
    totalPageCount: number;
  },
): void {
  const { pageWidthMm, pageNumber, totalPageCount } = ctx;
  const yMm = PAGE_MARGIN_MM - 6;
  // Left: site URL. Right: page X of N.
  page.drawText("trackfit.stevieweedseed.com", {
    x: mmToPt(PAGE_MARGIN_MM),
    y: mmToPt(yMm),
    size: 8,
    font: fontBody,
    color: rgb(0.4, 0.4, 0.45),
  });
  const pageLabel = `page ${pageNumber} of ${totalPageCount}`;
  const w = fontBody.widthOfTextAtSize(pageLabel, 8);
  page.drawText(pageLabel, {
    x: mmToPt(pageWidthMm - PAGE_MARGIN_MM) - w,
    y: mmToPt(yMm),
    size: 8,
    font: fontBody,
    color: rgb(0.4, 0.4, 0.45),
  });
}
