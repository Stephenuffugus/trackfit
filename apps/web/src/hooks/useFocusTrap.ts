import { useEffect, useRef } from "react";

/**
 * Selector for focusable elements inside a container. Mirrors what most
 * focus-trap libraries use; we keep our own copy to avoid pulling in a
 * dep for ~30 lines of behaviour. Negative tabindex (-1) is excluded so
 * intentionally-skipped elements stay skipped.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "audio[controls]",
  "video[controls]",
  "details > summary:first-of-type",
].join(",");

interface Options {
  /**
   * Whether the trap is active. Pass `open` from the parent — when this
   * flips to `false` the hook restores focus to whatever was focused
   * before the modal opened (typically the trigger button).
   */
  enabled: boolean;
  /**
   * Optional ESC handler. The hook listens for ESC internally and calls
   * this on keydown. Most modals already accept an `onClose` prop —
   * thread that through here.
   */
  onEscape?: () => void;
  /**
   * Where to land focus when the modal opens. Defaults to the first
   * focusable descendant. Set to "container" to focus the dialog
   * container itself (use when no inner control should auto-focus —
   * e.g. an image viewer).
   */
  initialFocus?: "first" | "container";
}

/**
 * Modal focus-trap hook. Returns a ref to attach to the modal's outer
 * dialog element. While `enabled`:
 *
 *   - Tab and Shift-Tab cycle within the container, skipping background
 *     elements entirely.
 *   - ESC fires `onEscape` if provided.
 *   - Initial focus lands on the first focusable child (or the
 *     container itself when `initialFocus === "container"`).
 *   - On disable / unmount, focus restores to whatever element had it
 *     when the trap was first activated — usually the gear button, the
 *     "What can I build?" CTA, or a photo thumbnail.
 *
 * The implementation is deliberately small. We don't try to handle the
 * truly hairy edge cases (shadow DOM, iframes, focusable invisible
 * elements) — none of those exist in this codebase, and adding a
 * library dep for an audience-of-five hobby app is overkill.
 */
export function useFocusTrap<T extends HTMLElement>({
  enabled,
  onEscape,
  initialFocus = "first",
}: Options) {
  const containerRef = useRef<T | null>(null);
  // Stash the active element at activation time so we can restore on
  // close. Each open/close cycle captures freshly.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    // Remember who had focus before we trapped, so we can give it back
    // on close. Body or null fallbacks shouldn't happen in practice
    // (the user always clicked a button to open the modal), but guard
    // against weirdness like an iframe focus or an already-removed node.
    const previouslyFocused =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    previouslyFocusedRef.current = previouslyFocused;

    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        // querySelectorAll doesn't filter by visibility; an element with
        // `display:none` ancestors still matches. Use offsetParent as a
        // cheap visibility proxy — null means hidden.
        .filter((el) => el.offsetParent !== null || el === container);

    // Land initial focus inside the modal. The setTimeout is so we run
    // *after* React has finished mounting the children; without it the
    // container has no focusable descendants yet on first paint.
    const t = window.setTimeout(() => {
      if (initialFocus === "container") {
        // Container needs tabindex=-1 to receive programmatic focus.
        // We set it here rather than requiring callers to remember.
        if (!container.hasAttribute("tabindex")) {
          container.setAttribute("tabindex", "-1");
        }
        container.focus();
        return;
      }
      const list = focusables();
      const first = list[0];
      if (first) {
        first.focus();
      } else {
        // Fall back to the container itself (e.g. an empty modal).
        if (!container.hasAttribute("tabindex")) {
          container.setAttribute("tabindex", "-1");
        }
        container.focus();
      }
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        return;
      }
      if (e.key !== "Tab") return;

      const list = focusables();
      if (list.length === 0) {
        // Nothing focusable inside — keep focus on the container so
        // tabbing doesn't escape into the page behind.
        e.preventDefault();
        container.focus();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        // Shift-Tab from the first (or anywhere outside the trap)
        // wraps to the last.
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab from the last (or anywhere outside the trap) wraps to
        // the first.
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      // Restore focus to whatever opened the modal. Guard for the
      // case where the previous element is no longer in the DOM
      // (e.g. inventory row deleted while a modal was open).
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev) && typeof prev.focus === "function") {
        // Defer one tick so React has finished unmounting the modal
        // — focusing an element that's about to be unmounted is fine,
        // but focusing the trigger before its parent has re-rendered
        // can cause a visible flash on some browsers.
        window.setTimeout(() => {
          prev.focus();
        }, 0);
      }
    };
  }, [enabled, onEscape, initialFocus]);

  return containerRef;
}
