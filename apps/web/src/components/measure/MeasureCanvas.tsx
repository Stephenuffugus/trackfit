import { useCallback, useEffect, useRef, useState } from "react";
import type { Point } from "@trackfit/measure";
import { pixelDistance } from "@trackfit/measure";
import { EndpointMarker } from "./EndpointMarker";
import type { EndpointPair } from "./state-machine";

interface Props {
  /** Photo data URL (gapPhoto from App state). */
  photoSrc: string;
  /** Endpoints already locked in for the reference (or null when not yet placed). */
  refEndpoints: EndpointPair | [Point, Point] | null;
  /** Endpoints currently being placed for the gap, or null in the reference phase. */
  gapEndpoints: EndpointPair | [Point, Point] | null;
  /** Which pair is currently editable: "ref" during step 2, "gap" during step 3, null in review. */
  editing: "ref" | "gap" | null;
  /** Update callback for the editable pair's endpoints. */
  onMoveEndpoint?: (index: 0 | 1, next: Point) => void;
}

/**
 * The photo + transparent SVG overlay.
 *
 * Coordinate system: we render the photo at its natural pixel dimensions
 * inside an SVG with `viewBox="0 0 W H"`, then let CSS scale the SVG to
 * fit the viewport. That keeps marker positions in the same coordinate
 * space the @trackfit/measure package reasons about (photo pixels), which
 * is exactly what `computeMeasurement` expects — no DPR / scale math
 * leaking into the overlay logic.
 *
 * Default endpoint positions when a fresh pair starts: we place them at
 * 30%/70% of the photo width on the horizontal centerline. The user can
 * drag from there. This avoids the "tap to place first endpoint, tap
 * again to place second" flow which is fiddlier on touch devices than
 * just-drag-the-marker-where-it-needs-to-go.
 */
export function MeasureCanvas({
  photoSrc,
  refEndpoints,
  gapEndpoints,
  editing,
  onMoveEndpoint,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  // Decode the image once to get its natural pixel dimensions; we need
  // them for the viewBox so SVG coordinates == photo pixels.
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = photoSrc;
    return () => {
      cancelled = true;
    };
  }, [photoSrc]);

  const toSvgPoint = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const out = pt.matrixTransform(inv);
    return { x: out.x, y: out.y };
  }, []);

  if (!dims) {
    // While the image loads, render a neutral placeholder rather than
    // letting layout jump when the SVG snaps in.
    return <div className="measure-canvas measure-canvas--loading" />;
  }

  // Brass for the reference, signal-red (accent) for the gap. Read straight
  // from the v0.2 token palette in styles/index.css.
  const REF_COLOR = "#9a7b3f"; // --brass
  const GAP_COLOR = "#b24b2b"; // --accent

  const livePixels = (() => {
    const pair = editing === "ref" ? refEndpoints : editing === "gap" ? gapEndpoints : null;
    if (!pair || !pair[0] || !pair[1]) return null;
    return pixelDistance(pair[0], pair[1]);
  })();

  return (
    <div className="measure-canvas">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        className="measure-canvas__svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <image href={photoSrc} x={0} y={0} width={dims.w} height={dims.h} />

        {/* Reference connector line. Solid when locked in, dashed while editing. */}
        {refEndpoints && refEndpoints[0] && refEndpoints[1] && (
          <line
            x1={refEndpoints[0].x}
            y1={refEndpoints[0].y}
            x2={refEndpoints[1].x}
            y2={refEndpoints[1].y}
            stroke={REF_COLOR}
            strokeWidth={3}
            strokeDasharray={editing === "ref" ? "8 6" : undefined}
            pointerEvents="none"
          />
        )}

        {/* Gap connector line. */}
        {gapEndpoints && gapEndpoints[0] && gapEndpoints[1] && (
          <line
            x1={gapEndpoints[0].x}
            y1={gapEndpoints[0].y}
            x2={gapEndpoints[1].x}
            y2={gapEndpoints[1].y}
            stroke={GAP_COLOR}
            strokeWidth={3}
            strokeDasharray={editing === "gap" ? "8 6" : undefined}
            pointerEvents="none"
          />
        )}

        {/* Reference markers — only draggable while editing == "ref". */}
        {refEndpoints && refEndpoints[0] && (
          <EndpointMarker
            point={refEndpoints[0]}
            color={REF_COLOR}
            label="A"
            onMove={(p) => editing === "ref" && onMoveEndpoint?.(0, p)}
            toSvgPoint={toSvgPoint}
            ariaLabel="Drag reference endpoint A"
          />
        )}
        {refEndpoints && refEndpoints[1] && (
          <EndpointMarker
            point={refEndpoints[1]}
            color={REF_COLOR}
            label="B"
            onMove={(p) => editing === "ref" && onMoveEndpoint?.(1, p)}
            toSvgPoint={toSvgPoint}
            ariaLabel="Drag reference endpoint B"
          />
        )}

        {/* Gap markers — only draggable while editing == "gap". */}
        {gapEndpoints && gapEndpoints[0] && (
          <EndpointMarker
            point={gapEndpoints[0]}
            color={GAP_COLOR}
            label="1"
            onMove={(p) => editing === "gap" && onMoveEndpoint?.(0, p)}
            toSvgPoint={toSvgPoint}
            ariaLabel="Drag gap endpoint 1"
          />
        )}
        {gapEndpoints && gapEndpoints[1] && (
          <EndpointMarker
            point={gapEndpoints[1]}
            color={GAP_COLOR}
            label="2"
            onMove={(p) => editing === "gap" && onMoveEndpoint?.(1, p)}
            toSvgPoint={toSvgPoint}
            ariaLabel="Drag gap endpoint 2"
          />
        )}
      </svg>

      {livePixels !== null && (
        <div className="measure-canvas__live" aria-live="polite">
          {Math.round(livePixels)} px
        </div>
      )}
    </div>
  );
}

/**
 * Suggested initial positions for a fresh endpoint pair, given the
 * photo's natural width/height. Exposed so the overlay parent can
 * pre-fill endpoints when stepping forward into a new placement phase.
 */
export function defaultEndpointsFor(width: number, height: number): [Point, Point] {
  const y = Math.round(height / 2);
  return [
    { x: Math.round(width * 0.3), y },
    { x: Math.round(width * 0.7), y },
  ];
}
