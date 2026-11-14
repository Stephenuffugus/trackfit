import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

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

  // Focus trap. ESC is already handled by the keydown effect above
  // (alongside arrow-key navigation), so we don't pass onEscape here —
  // doing so would double-fire. Initial focus lands on the dialog
  // container itself rather than the first focusable child — the DOM
  // order puts the close (×) button first, and we don't want a stray
  // Enter on modal-open to silently dismiss onboarding for an older
  // user who hasn't read it yet. The trap still restores focus to the
  // settings menu's "Show intro again" button (or the inventory's
  // help button on first run) on close.
  const trapRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    initialFocus: "container",
  });

  if (!open) return null;

  return (
    <div
      ref={trapRef}
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
        Trackfit looks at the sectional track you own and shows the
        complete loops you can build from it, drawn piece by piece. It can
        also find which pieces fill an awkward gap.
      </p>
      <img
        className="onboarding-oval"
        src={`${import.meta.env.BASE_URL}icon.svg`}
        alt="An oval of track: straights on the long sides, curves at the ends"
        width={160}
        height={160}
      />
    </article>
  );
}

/** Card 2 — picking inventory. */
function CardTwo() {
  return (
    <article className="onboarding-card">
      <p className="eyebrow">Steps 1 and 2</p>
      <h2>Tell it your track</h2>
      <p className="onboarding-body">
        Choose your brand from the list. Every piece it makes appears with
        a count of 1. Set each count to what you own. If you own only a
        few kinds, tap <strong>All counts to 0</strong> first.
      </p>
      <p className="onboarding-body onboarding-body--hint">
        Your list is kept on this phone or tablet, so it is there next time.
      </p>
    </article>
  );
}

/** Card 3 — what can I build. */
function CardThree() {
  return (
    <article className="onboarding-card">
      <p className="eyebrow">Step 3</p>
      <h2>See what you can build</h2>
      <p className="onboarding-body">
        Tap <strong>Show loops I can build</strong>. Each answer is drawn,
        with the pieces to take out of the box and the table space it
        needs. Print it and take it to the train room.
      </p>
      <p className="onboarding-body onboarding-body--hint">
        Filling a gap instead? Type its length under{" "}
        <strong>Fill one gap</strong>.
      </p>
    </article>
  );
}
