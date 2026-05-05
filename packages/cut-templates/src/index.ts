/**
 * @trackfit/cut-templates — public surface.
 *
 * Consumers should import from this entrypoint only. Internals (pdf-lib
 * imports, drawing helpers, layout constants) are intentionally not
 * re-exported so we can refactor the renderer without breaking callers.
 */

export { renderCutTemplate } from "./render.js";
export {
  PT_PER_INCH,
  MM_PER_INCH,
  MM_TO_PT,
  mmToPt,
  inToPt,
  mmToIn,
} from "./render.js";
export type {
  CutTemplateInput,
  CutTemplateResult,
  PaperSize,
} from "./types.js";
