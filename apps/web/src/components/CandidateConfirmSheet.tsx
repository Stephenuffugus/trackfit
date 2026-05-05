import { useFocusTrap } from "../hooks/useFocusTrap";
import type { IdentifyCandidate } from "../lib/identify-piece";

interface Props {
  open: boolean;
  candidates: IdentifyCandidate[];
  /** Thumbnail of the just-captured photo so the user can compare. */
  photoSrc: string | null;
  onPick: (candidate: IdentifyCandidate) => void;
  /** "None of these — let me type it" escape hatch. */
  onManual: () => void;
  onClose: () => void;
}

/**
 * Render a candidate's confidence as a 5-block bar. Re-uses the
 * `.layout-score` / `.layout-score-block` CSS pattern from the layout
 * suggester so this surface stays inside the existing aesthetic
 * (permission-gated per handoff §9 — no new visual styles).
 */
function ConfidenceBar({ score }: { score: number }) {
  const blocks = Math.round(Math.max(0, Math.min(1, score)) * 5);
  return (
    <span
      className="layout-score"
      aria-label={`Confidence ${blocks} of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`layout-score-block${i < blocks ? " on" : ""}`}
        />
      ))}
    </span>
  );
}

/**
 * Plain-English specs line. Curves get "558.8 mm radius · 22.5°";
 * everything else gets "228.6 mm". Older hobbyists read units in
 * full, not abbreviations — the v0.2 prototype set that voice and we
 * keep it.
 */
function specsLine(c: IdentifyCandidate): string {
  if (c.kind === "curve" && c.radius_mm && c.arc_degrees) {
    return `${c.radius_mm.toFixed(1)} mm radius · ${c.arc_degrees}°`;
  }
  return `${c.length_mm.toFixed(1)} mm`;
}

/**
 * Modal that fires when the photo identifier returned candidates but
 * none crossed the auto-fill confidence threshold. The user sees the
 * three guesses (photo top, candidates underneath) and either picks
 * one or punches out to manual entry.
 *
 * ESC and the backdrop both close as "no decision". The existing
 * manual-entry flow stays intact — per handoff §3, photo-ID never
 * blocks the user.
 *
 * No new visual styles introduced. Re-uses .modal / .modal-inner /
 * .modal-actions / .layout-score plumbing already in index.css. CSS
 * for this component's specific bits (the candidate row layout, the
 * thumbnail) lives at the bottom of index.css under the
 * "CANDIDATE CONFIRM SHEET" heading.
 */
export function CandidateConfirmSheet({
  open,
  candidates,
  photoSrc,
  onPick,
  onManual,
  onClose,
}: Props) {
  // Focus trap + ESC + restore-focus to whatever opened the sheet
  // (the photo button on the inventory row).
  const trapRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    onEscape: onClose,
  });

  if (!open) return null;

  const handleManual = () => {
    onManual();
    onClose();
  };

  return (
    <div
      ref={trapRef}
      className="modal open candidate-confirm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm what we identified"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner candidate-confirm__inner">
        <div className="candidate-confirm__head">
          <h2>What did you photograph?</h2>
          <p className="hint">
            We weren't sure. Pick the closest match, or type it in
            yourself.
          </p>
        </div>

        {photoSrc ? (
          <div className="candidate-confirm__photo">
            <img src={photoSrc} alt="Just-captured track piece" />
          </div>
        ) : null}

        <ul className="candidate-confirm__list">
          {candidates.map((c, i) => (
            <li key={`${c.label}-${i}`}>
              <button
                type="button"
                className="candidate-confirm__row"
                onClick={() => onPick(c)}
              >
                <div className="candidate-confirm__row-text">
                  <span className="candidate-confirm__label">{c.label}</span>
                  {c.system_label ? (
                    <span className="candidate-confirm__system">
                      {c.system_label}
                    </span>
                  ) : null}
                  <span className="candidate-confirm__specs">
                    {specsLine(c)}
                  </span>
                </div>
                <ConfidenceBar score={c.confidence} />
              </button>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={handleManual}
          >
            None of these — type it manually
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
