import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * First-run onboarding. Three plain-English cards explaining what
 * Trackfit is and how to use it. Swipeable on mobile (touch), arrow
 * keys on desktop, big nav buttons either way.
 *
 * Persistence is handled by the caller via `trackfit.onboarded.v1`.
 * This component is purely presentational + navigation.
 */
export function Onboarding({ open, onClose }: Props) {
  const [card, setCard] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);

  // Reset to card 0 every time the modal opens.
  useEffect(() => {
    if (open) setCard(0);
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const next = useCallback(() => {
    setCard((c) => Math.min(c + 1, 2));
  }, []);
  const prev = useCallback(() => {
    setCard((c) => Math.max(c - 1, 0));
  }, []);

  // Arrow keys + escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, onClose]);

  // Touch swipe.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStart.current;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) next();
    else prev();
    touchStart.current = null;
  };

  const handlePrimary = () => {
    if (card < 2) next();
    else onClose();
  };

  if (!open) return null;

  return (
    <div
      className="modal open onboarding-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Trackfit"
      onClick={(e) => {
        // Don't dismiss on backdrop click — the modal is dismissed
        // only via the explicit final button or Escape. Older users
        // are likely to tap the dim backdrop expecting "more info".
        if (e.target === e.currentTarget) {
          /* swallow */
        }
      }}
    >
      <div
        className="modal-inner onboarding-inner"
        ref={trackRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          className="onboarding-close"
          aria-label="Close intro"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="onboarding-cards" data-card={card}>
          {card === 0 && <CardOne />}
          {card === 1 && <CardTwo />}
          {card === 2 && <CardThree />}
        </div>

        <div className="onboarding-dots" aria-hidden="true">
          <span className={card === 0 ? "active" : ""} />
          <span className={card === 1 ? "active" : ""} />
          <span className={card === 2 ? "active" : ""} />
        </div>

        <div className="onboarding-nav">
          <button
            type="button"
            className="onboarding-arrow"
            onClick={prev}
            disabled={card === 0}
            aria-label="Previous card"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="onboarding-primary"
            onClick={handlePrimary}
          >
            {card < 2 ? "Got it →" : "Start using Trackfit →"}
          </button>
          <button
            type="button"
            className="onboarding-arrow"
            onClick={next}
            disabled={card === 2}
            aria-label="Next card"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Card 1 — what Trackfit is. */
function CardOne() {
  return (
    <article className="onboarding-card">
      <p className="eyebrow">Welcome</p>
      <h2>What is this?</h2>
      <p className="onboarding-body">
        Trackfit helps you fit track pieces into a layout gap. Tell it
        what's in your box and the gap you're trying to fill — it'll
        find combinations that work.
      </p>
      <BlueprintBar />
    </article>
  );
}

/** Card 2 — picking inventory. */
function CardTwo() {
  return (
    <article className="onboarding-card">
      <p className="eyebrow">Step one</p>
      <h2>Pick what you have</h2>
      <p className="onboarding-body">
        Tap a brand to load the standard pieces, then change the
        quantities to match your box. You can also add a piece by hand
        if you have something unusual.
      </p>
      <p className="onboarding-body onboarding-body--hint">
        A photo on each row is optional, but it helps when you come
        back later and forget which piece was which.
      </p>
    </article>
  );
}

/** Card 3 — solve flow. */
function CardThree() {
  return (
    <article className="onboarding-card">
      <p className="eyebrow">Step two</p>
      <h2>Tell it your gap, get an answer</h2>
      <p className="onboarding-body">
        Type how long the gap is. Tap{" "}
        <strong>Find combinations</strong>. You'll get every way to
        fill it — and if no exact fit, the precise piece you'd need.
      </p>
      <p className="onboarding-body onboarding-body--hint">
        Don't have a tape measure? Snap a photo with a quarter or
        dollar bill in frame and tap Measure.
      </p>
    </article>
  );
}

/**
 * Simplified blueprint of the result-card bar (the stacked colored
 * segments showing how pieces add up to the target). Inline SVG so we
 * don't ship another asset.
 */
function BlueprintBar() {
  return (
    <svg
      className="onboarding-blueprint"
      viewBox="0 0 320 92"
      role="img"
      aria-label="Illustration of a track-fit result"
    >
      {/* Outer frame */}
      <rect
        x="1"
        y="1"
        width="318"
        height="90"
        fill="#fdf8ee"
        stroke="#1a2238"
        strokeWidth="1.5"
      />
      {/* Hatched ground */}
      <defs>
        <pattern
          id="hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="#1a2238" strokeWidth="0.4" />
        </pattern>
      </defs>
      {/* Title */}
      <text
        x="14"
        y="22"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="9"
        fill="#4a5169"
        letterSpacing="1.4"
      >
        TARGET 19" · EXACT FIT
      </text>
      {/* Bar segments */}
      <rect x="14" y="34" width="120" height="34" fill="#b24b2b" stroke="#1a2238" />
      <rect x="134" y="34" width="80" height="34" fill="#2e4a6b" stroke="#1a2238" />
      <rect x="214" y="34" width="92" height="34" fill="#9a7b3f" stroke="#1a2238" />
      {/* Labels under the bar */}
      <text
        x="14"
        y="82"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="8"
        fill="#4a5169"
      >
        10"
      </text>
      <text
        x="134"
        y="82"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="8"
        fill="#4a5169"
      >
        5"
      </text>
      <text
        x="214"
        y="82"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="8"
        fill="#4a5169"
      >
        4"
      </text>
    </svg>
  );
}
