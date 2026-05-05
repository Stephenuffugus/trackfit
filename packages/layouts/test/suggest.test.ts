/**
 * Tests for the rule-based layout suggester.
 *
 * The suggester is the headline answer to the hobbyist's question
 * "what can I build with this pile of track?". These tests cover:
 *  - the empty-inventory degenerate case (sanity)
 *  - a real Lionel FasTrack starter-set inventory matches Simple oval
 *  - dropping a curve from that inventory makes the oval not-buildable
 *    while still surfacing it as the closest near-miss
 *  - a yard-shaped inventory ranks Yard ladder highest
 *  - scale filtering hides HO-only templates from N-scale users
 *  - every returned rationale is a non-empty plain-English string
 */
import { describe, expect, it } from "vitest";
import { getSystem } from "@trackfit/library";
import type { TrackPiece } from "@trackfit/library";
import { LAYOUT_TEMPLATES, suggestLayouts } from "../src/index.js";
import type { SuggesterInventoryItem } from "../src/index.js";

/**
 * Build a SuggesterInventoryItem from a library TrackPiece + a quantity.
 * Mirrors what the web UI does when persisting inventory rows from a preset.
 */
function row(piece: TrackPiece, qty: number): SuggesterInventoryItem {
  return {
    label: piece.label,
    kind: piece.kind,
    length_mm: piece.length_mm,
    radius_mm: piece.radius_mm ?? null,
    arc_degrees: piece.arc_degrees ?? null,
    qty,
  };
}

/** Look up a piece in a system by id; throws if missing so tests fail loudly. */
function pieceById(systemId: string, pieceId: string): TrackPiece {
  const sys = getSystem(systemId);
  if (!sys) throw new Error(`unknown system ${systemId}`);
  const piece = sys.pieces.find((p) => p.id === pieceId);
  if (!piece) throw new Error(`unknown piece ${systemId}/${pieceId}`);
  return piece;
}

describe("suggestLayouts", () => {
  it("with an empty inventory returns templates whose shortfalls equal each template's full requirements", () => {
    const out = suggestLayouts({ inventory: [] });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      const req = s.template.requirements;
      expect(s.shortfall.straight_length_mm).toBe(req.straight_length_mm);
      expect(s.shortfall.curve_total_degrees).toBe(req.curve_total_degrees);
      expect(s.shortfall.turnouts).toBe(req.turnouts ?? 0);
      expect(s.shortfall.crossings).toBe(req.crossings ?? 0);
      expect(s.buildable).toBe(false);
    }
  });

  it("matches Simple oval as buildable for a Lionel FasTrack starter inventory", () => {
    // A Lionel FasTrack starter set ships with 12× O36 curve (= 360°) and
    // ~4× 10" straight (= 1016mm). That's a true continuous oval — both the
    // straight and curve requirements of `simple-oval` are met or exceeded.
    const inventory: SuggesterInventoryItem[] = [
      row(pieceById("lionel-fastrack", "10in-straight"), 4),
      row(pieceById("lionel-fastrack", "o36-curve"), 12),
    ];
    const out = suggestLayouts({ inventory });
    const simpleOval = out.find((s) => s.template.id === "simple-oval");
    expect(simpleOval).toBeDefined();
    expect(simpleOval!.buildable).toBe(true);
    expect(simpleOval!.shortfall.straight_length_mm).toBe(0);
    expect(simpleOval!.shortfall.curve_total_degrees).toBe(0);
    expect(simpleOval!.match_score).toBeCloseTo(1, 5);
  });

  it("flags Simple oval as not-buildable when one curve is missing, with a real curve shortfall", () => {
    const inventory: SuggesterInventoryItem[] = [
      row(pieceById("lionel-fastrack", "10in-straight"), 4),
      // 11 curves = 330° — one 30° section short of a closed loop.
      row(pieceById("lionel-fastrack", "o36-curve"), 11),
    ];
    const out = suggestLayouts({ inventory });
    const simpleOval = out.find((s) => s.template.id === "simple-oval");
    expect(simpleOval).toBeDefined();
    expect(simpleOval!.buildable).toBe(false);
    expect(simpleOval!.match_score).toBeLessThan(1);
    expect(simpleOval!.shortfall.curve_total_degrees).toBeGreaterThan(0);
    expect(simpleOval!.shortfall.curve_total_degrees).toBeCloseTo(30, 5);
  });

  it("ranks Yard ladder highest for an HO yard inventory (8 turnouts + lots of straights)", () => {
    // Use Atlas HO Code 83 turnouts and 9" straights as a realistic HO yard.
    const turnout = pieceById("atlas-ho-code-83", "customline-4-turnout-left");
    const straight9 = pieceById("atlas-ho-code-83", "9in-straight");
    const inventory: SuggesterInventoryItem[] = [
      { label: turnout.label, kind: "turnout", length_mm: turnout.length_mm, qty: 8 },
      row(straight9, 20),
    ];
    const out = suggestLayouts({ inventory, scale: "HO" });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.template.id).toBe("yard-ladder");
    expect(out[0]!.buildable).toBe(true);
  });

  it("does not return HO-only templates to an N-scale user", () => {
    const out = suggestLayouts({ inventory: [], scale: "N" });
    for (const s of out) {
      if (s.template.scales !== null) {
        expect(s.template.scales).toContain("N");
      }
    }
    // The HO-pinned Christmas-tree loop must be filtered out.
    expect(out.find((s) => s.template.id === "christmas-tree-loop-ho")).toBeUndefined();
    // The N-pinned variant should still be present.
    expect(out.find((s) => s.template.id === "christmas-tree-loop-n")).toBeDefined();
  });

  it("always renders a non-empty plain-English rationale for every suggestion", () => {
    // Mix three inventory shapes through the same assertion so we cover
    // the buildable, near-miss, and empty branches of buildRationale.
    const inventories: SuggesterInventoryItem[][] = [
      [],
      [
        row(pieceById("lionel-fastrack", "10in-straight"), 4),
        row(pieceById("lionel-fastrack", "o36-curve"), 12),
      ],
      [
        row(pieceById("atlas-ho-code-83", "9in-straight"), 6),
        row(pieceById("atlas-ho-code-83", "18in-radius-30deg-curve"), 4),
      ],
    ];
    for (const inventory of inventories) {
      const out = suggestLayouts({ inventory });
      expect(out.length).toBeGreaterThan(0);
      for (const s of out) {
        expect(typeof s.rationale).toBe("string");
        expect(s.rationale.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("ships every template with valid style/complexity/appeal metadata", () => {
    // The suggester UI filters and sorts on these fields. A missing or empty
    // value would break the chip filter or render an italic-blank pitch line,
    // so validate the catalog at the boundary.
    const validStyles = new Set([
      "continuous-loop",
      "switching",
      "showcase",
      "starter",
    ]);
    expect(LAYOUT_TEMPLATES.length).toBeGreaterThan(0);
    for (const tpl of LAYOUT_TEMPLATES) {
      expect(tpl.style, `style on ${tpl.id}`).toBeDefined();
      expect(validStyles.has(tpl.style), `valid style on ${tpl.id}`).toBe(true);
      expect(typeof tpl.complexity, `complexity on ${tpl.id}`).toBe("number");
      expect(tpl.complexity, `complexity on ${tpl.id}`).toBeGreaterThanOrEqual(1);
      expect(tpl.complexity, `complexity on ${tpl.id}`).toBeLessThanOrEqual(5);
      expect(typeof tpl.appeal, `appeal on ${tpl.id}`).toBe("string");
      expect(tpl.appeal.trim().length, `appeal on ${tpl.id}`).toBeGreaterThan(0);
    }
  });

  it("sorts buildable templates first, regardless of score", () => {
    // Sort contract — buildable layouts must never be ranked below
    // non-buildable ones. The cap was raised to >= catalog size so that
    // scale-pinned templates always make the cut for users who specified
    // their scale; the UI is responsible for any visual top-N truncation.
    const inventory: SuggesterInventoryItem[] = [
      row(pieceById("lionel-fastrack", "10in-straight"), 8),
      row(pieceById("lionel-fastrack", "o36-curve"), 24),
    ];
    const out = suggestLayouts({ inventory });
    expect(out.length).toBeLessThanOrEqual(LAYOUT_TEMPLATES.length);
    let sawNonBuildable = false;
    for (const s of out) {
      if (!s.buildable) sawNonBuildable = true;
      else expect(sawNonBuildable).toBe(false);
    }
    // Catalog itself must be reachable for the typecheck.
    expect(LAYOUT_TEMPLATES.length).toBeGreaterThanOrEqual(8);
  });
});
