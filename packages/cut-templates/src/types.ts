/**
 * Trackfit cut-template types.
 *
 * The renderer takes a CutTemplateInput describing a single flex-track cut
 * and produces a CutTemplateResult containing a PDF byte payload that the
 * caller can save, stream, or hand to a download link in the browser.
 *
 * Why these inputs are minimal: the only thing the hobbyist actually needs
 * a printable template for is "I have a Y-mm flex piece, I need to cut it
 * down to X mm — show me where to cut, at 1:1 scale." Everything else
 * (registration marks, calibration ruler, header text) is the renderer's
 * job to compute. Don't add knobs the user shouldn't be touching.
 */

export type PaperSize = "letter" | "a4";

export interface CutTemplateInput {
  /** desired cut length in millimetres — this is where the "cut here" line lands */
  target_length_mm: number;
  /** nominal length of the un-cut flex track piece, e.g. 914 for Peco Streamline */
  flex_nominal_length_mm: number;
  /** paper to tile onto. defaults to letter when omitted at the input layer */
  paper_size: PaperSize;
  /** label printed in the header so a stack of templates is identifiable */
  track_label: string;
  /**
   * Optional ISO date override, primarily for deterministic test fixtures.
   * When omitted, the renderer stamps `new Date().toISOString().slice(0,10)`.
   */
  date_iso?: string;
}

export interface CutTemplateResult {
  /** raw PDF bytes — caller decides how to deliver (Blob, file, response) */
  pdf: Uint8Array;
  /** number of physical pages in the tiled output */
  page_count: number;
  /** paper used (echo of input, useful when the input was defaulted upstream) */
  paper_size: PaperSize;
  /** echo of the cut-line position for callers that want to label the UI */
  target_length_mm: number;
}
