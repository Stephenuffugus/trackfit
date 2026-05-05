import { useCallback, useEffect, useRef } from "react";
import type { Point } from "@trackfit/measure";

interface Props {
  /** Position of the marker in SVG-user-coordinate space (matches photo px). */
  point: Point;
  /** Stroke + fill color — usually the brass or signal-red token. */
  color: string;
  /** Plain-English label rendered next to the marker (e.g. "A" or "B"). */
  label: string;
  /**
   * Called continuously while the user drags. The point is in the same
   * SVG-user-coordinate space as `point`, so the parent can store it
   * directly without re-projecting.
   */
  onMove: (next: Point) => void;
  /**
   * Maps a pointer event's clientX/clientY to SVG-user coordinates. The
   * parent (which owns the SVG) provides this so we don't have to thread
   * the SVGSVGElement ref through.
   */
  toSvgPoint: (clientX: number, clientY: number) => Point;
  /**
   * Optional aria-label override; falls back to "Drag endpoint {label}".
   */
  ariaLabel?: string;
}

/**
 * A draggable circle marker on the SVG measurement overlay.
 *
 * Two concentric shapes:
 *   - 18px visible filled circle (the part the user sees)
 *   - 40px transparent circle covering it (the part the user can hit)
 *
 * The bigger hit zone is non-negotiable. The audience is over 60 and
 * fingers, especially in winter basements, are not stylus-precise. The
 * Apple HIG minimum is 44px for primary actions; we round down because
 * we have two markers per pair and want them close enough to mark short
 * objects (a quarter is ~24mm, ~80px in a tight crop).
 *
 * Pointer events are used (not touch + mouse separately) so a single code
 * path covers iOS Safari, Android Chrome, and desktop. Pointer capture is
 * set on pointerdown so the drag continues even if the finger slides off
 * the marker — important on small-screen one-handed use.
 */
export function EndpointMarker({
  point,
  color,
  label,
  onMove,
  toSvgPoint,
  ariaLabel,
}: Props) {
  const dragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      onMove(toSvgPoint(e.clientX, e.clientY));
    },
    [onMove, toSvgPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      if (!dragging.current) return;
      e.preventDefault();
      onMove(toSvgPoint(e.clientX, e.clientY));
    },
    [onMove, toSvgPoint],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      dragging.current = false;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    },
    [],
  );

  // Belt-and-suspenders: if the React tree unmounts mid-drag, drop the flag.
  useEffect(() => {
    return () => {
      dragging.current = false;
    };
  }, []);

  return (
    <g
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: "grab", touchAction: "none" }}
      aria-label={ariaLabel ?? `Drag endpoint ${label}`}
      role="slider"
    >
      {/* Hit zone — invisible, 40px diameter (20px radius). */}
      <circle cx={point.x} cy={point.y} r={20} fill="transparent" />
      {/* Visible marker — 18px diameter (9px radius), with a 2px white halo
          so it stays legible against busy photo backgrounds. */}
      <circle
        cx={point.x}
        cy={point.y}
        r={11}
        fill="#fdf8ee"
        stroke={color}
        strokeWidth={3}
        pointerEvents="none"
      />
      <circle
        cx={point.x}
        cy={point.y}
        r={5}
        fill={color}
        pointerEvents="none"
      />
      <text
        x={point.x + 16}
        y={point.y - 14}
        fill={color}
        stroke="#fdf8ee"
        strokeWidth={3}
        paintOrder="stroke"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize={13}
        fontWeight={600}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}
