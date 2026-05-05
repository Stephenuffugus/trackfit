import { useState } from "react";
import type { PaperSize } from "@trackfit/cut-templates";
import { downloadPdf } from "../lib/download";

// pdf-lib is ~250KB; lazy-load it so the initial bundle stays small.
// Most users open Trackfit, solve a gap, and never click "Print template" —
// they shouldn't pay the bundle cost for a feature they don't use.
const renderCutTemplate = async (
  ...args: Parameters<typeof import("@trackfit/cut-templates").renderCutTemplate>
) => {
  const mod = await import("@trackfit/cut-templates");
  return mod.renderCutTemplate(...args);
};

interface FlexCandidate {
  label: string;
  length_mm: number;
}

interface CutTemplateButtonProps {
  /** the missing piece length the solver suggested */
  missingLengthMm: number;
  /** the available flex tracks the user owns (filtered list of InventoryRow) */
  flexCandidates: FlexCandidate[];
}

/**
 * "Print 1:1 cut template" action.
 *
 * Renders nothing when the user has no flex candidates — without flex there's
 * nothing to cut. On click the button reveals a small inline picker (radio
 * source + paper-size toggle), then calls @trackfit/cut-templates to render a
 * tiled PDF and triggers a browser download.
 *
 * Deliberately not a modal: this is a quick, secondary action attached to a
 * SUGGESTED callout. A full overlay would oversell it.
 */
export function CutTemplateButton({
  missingLengthMm,
  flexCandidates,
}: CutTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [paper, setPaper] = useState<PaperSize>("letter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (flexCandidates.length === 0) return null;

  // Defensive: if the previously-picked index falls off the end (e.g. the
  // user removed an inventory row while the popover was open) snap to 0.
  const safeIdx = Math.min(sourceIdx, flexCandidates.length - 1);
  const picked = flexCandidates[safeIdx]!;

  const onGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await renderCutTemplate({
        target_length_mm: missingLengthMm,
        flex_nominal_length_mm: picked.length_mm,
        paper_size: paper,
        track_label: picked.label,
      });
      const filename = `trackfit-cut-${missingLengthMm.toFixed(0)}mm.pdf`;
      downloadPdf(result.pdf, filename);
      setOpen(false);
    } catch (e) {
      // Most likely cause: target_length_mm > flex_nominal_length_mm. Surface
      // the renderer's message verbatim — it's already user-readable.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cut-template">
      <button
        type="button"
        className="btn cut-template-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Close" : "Print 1:1 cut template"}
      </button>

      {open ? (
        <div className="card cut-template-popover">
          <p className="field-label">Cut from</p>
          <div className="cut-template-sources">
            {flexCandidates.map((fc, i) => (
              <label key={`${fc.label}-${i}`} className="cut-template-radio">
                <input
                  type="radio"
                  name="cut-template-source"
                  checked={i === safeIdx}
                  onChange={() => setSourceIdx(i)}
                />
                <span>
                  {fc.label}{" "}
                  <span className="cut-template-len">
                    ({fc.length_mm.toFixed(0)} mm)
                  </span>
                </span>
              </label>
            ))}
          </div>

          <p className="field-label cut-template-paper-label">Paper</p>
          <div className="unit-toggle cut-template-paper">
            <button
              type="button"
              className={paper === "letter" ? "active" : ""}
              onClick={() => setPaper("letter")}
            >
              Letter
            </button>
            <button
              type="button"
              className={paper === "a4" ? "active" : ""}
              onClick={() => setPaper("a4")}
            >
              A4
            </button>
          </div>

          {error ? <p className="cut-template-error">{error}</p> : null}

          <div className="cut-template-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn cut-template-submit"
              onClick={onGenerate}
              disabled={busy}
            >
              {busy ? "Generating…" : "Generate PDF"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
