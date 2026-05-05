/**
 * Tests for the brand-attribution work in `presets.ts` and the picker's
 * `pieceToInventoryRow` (focus-group P2-T2-F3).
 *
 * The load-bearing invariants:
 *   1. presetToInventory stamps `system_id` onto every row it produces.
 *   2. inferSystemForRows prefers the explicit `system_id` over the v0.2
 *      label-match fallback. Margaret's hand-typed Bachmann row sitting
 *      next to a preset-loaded Atlas inventory must NOT silently inherit
 *      Atlas vendor links.
 *   3. The PiecePicker's pieceToInventoryRow stamps `system_id` from the
 *      source system, so a piece picked while no preset is active still
 *      carries a brand attribution.
 */
import { describe, expect, it } from "vitest";
import { getSystem, listSystems } from "@trackfit/library";
import {
  inferSystemForRows,
  presetToInventory,
} from "../presets";
import { pieceToInventoryRow } from "../piece-picker";

describe("presets — system_id propagation", () => {
  it("presetToInventory stamps system_id on every row", () => {
    const sys = getSystem("atlas-ho-code-83")!;
    const rows = presetToInventory(sys);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.system_id).toBe("atlas-ho-code-83");
    }
  });

  it("presetToInventory uses the system's id, not the manufacturer name", () => {
    // Defends against the easy bug of stamping `manufacturer` (e.g. "Atlas")
    // instead of `id` (e.g. "atlas-ho-code-83").
    const sys = getSystem("bachmann-ez-track-ho")!;
    const rows = presetToInventory(sys);
    expect(rows[0]?.system_id).toBe("bachmann-ez-track-ho");
  });
});

describe("inferSystemForRows — explicit system_id wins", () => {
  it("prefers explicit system_id over label matching", () => {
    // Build a row whose label happens to match an Atlas piece, but whose
    // explicit system_id says Bachmann. The fix should pick Bachmann.
    const atlas = getSystem("atlas-ho-code-83")!;
    const bachmann = getSystem("bachmann-ez-track-ho")!;
    const atlasLabel = atlas.pieces[0]!.label;

    const rows = [
      { label: atlasLabel, system_id: "bachmann-ez-track-ho" },
    ];
    const inferred = inferSystemForRows(rows, [atlas, bachmann]);
    expect(inferred?.id).toBe(bachmann.id);
  });

  it("with mixed system_ids picks the most-represented brand", () => {
    // Margaret's case (focus-group P2-T2-F3): three Atlas pieces and two
    // Bachmann. The dominant brand should win — and the marketplace
    // expander will subsequently surface a "(2 other brand pieces in this
    // combo)" note to keep her honest.
    const rows = [
      { label: "x", system_id: "atlas-ho-code-83" },
      { label: "y", system_id: "atlas-ho-code-83" },
      { label: "z", system_id: "atlas-ho-code-83" },
      { label: "a", system_id: "bachmann-ez-track-ho" },
      { label: "b", system_id: "bachmann-ez-track-ho" },
    ];
    const inferred = inferSystemForRows(rows, listSystems());
    expect(inferred?.id).toBe("atlas-ho-code-83");
  });

  it("falls back to label matching when no row has system_id", () => {
    // Pre-system_id persisted state must still resolve.
    const atlas = getSystem("atlas-ho-code-83")!;
    const sample = atlas.pieces.slice(0, 3).map((p) => ({ label: p.label }));
    const inferred = inferSystemForRows(sample, listSystems());
    expect(inferred?.id).toBe("atlas-ho-code-83");
  });

  it("ignores explicit system_id values that don't match any known system", () => {
    // A stale persisted row referencing a removed system should fall back
    // to the label-match heuristic, not return that orphan id.
    const atlas = getSystem("atlas-ho-code-83")!;
    const orphanLabel = atlas.pieces[0]!.label;
    const rows = [
      { label: orphanLabel, system_id: "system-that-does-not-exist" },
    ];
    const inferred = inferSystemForRows(rows, listSystems());
    expect(inferred?.id).toBe("atlas-ho-code-83");
  });

  it("returns undefined for an empty inventory", () => {
    expect(inferSystemForRows([], listSystems())).toBeUndefined();
  });
});

describe("piece-picker — pieceToInventoryRow stamps system_id", () => {
  it("a picker-added piece carries the source system's id", () => {
    // The picker can run without an active preset (buildPickerSections's
    // no-active-preset path): a piece picked from there must still carry
    // its source system_id so the marketplace expander attributes it.
    const sys = getSystem("kato-unitrack-n")!;
    const piece = sys.pieces.find((p) => p.kind === "straight");
    expect(piece).toBeDefined();
    const row = pieceToInventoryRow(piece!, sys);
    expect(row).not.toBeNull();
    expect(row!.system_id).toBe("kato-unitrack-n");
  });

  it("works for curves too — the chip should render on every kind", () => {
    const sys = getSystem("lionel-fastrack")!;
    const curve = sys.pieces.find((p) => p.kind === "curve");
    expect(curve).toBeDefined();
    const row = pieceToInventoryRow(curve!, sys);
    expect(row?.system_id).toBe("lionel-fastrack");
  });
});
