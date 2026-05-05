/**
 * Picker logic tests. The dedupe-and-bump rule is the load-bearing one
 * here: if the user picks a piece type they already own, the picker
 * must bump qty on the existing row instead of pushing a duplicate.
 *
 * Identity is geometric — a renamed row still dedupes — so we test
 * with both label-equal and label-different scenarios.
 */
import { describe, expect, it } from "vitest";
import { listSystems, getSystem } from "@trackfit/library";
import {
  addOrBump,
  buildPickerSections,
  findInventoryDuplicate,
  inventoryRowSignature,
  pieceToInventoryRow,
} from "../piece-picker";
import type { InventoryRow } from "../types";

function makeStraightRow(label: string, length_mm: number, qty = 1): InventoryRow {
  return { label, length_mm, qty, photo: null, kind: "straight" };
}

describe("piece-picker — buildPickerSections", () => {
  it("emits one section per kind under the active preset", () => {
    const sys = getSystem("lionel-fastrack");
    expect(sys).toBeDefined();
    const sections = buildPickerSections({
      activeSystem: sys!,
      allSystems: [sys!],
      inventory: [],
      query: "",
    });
    // Lionel FasTrack has straights and curves at minimum.
    const kinds = new Set(sections.map((s) => s.kindLabel));
    expect(kinds.has("Straights")).toBe(true);
    expect(kinds.has("Curves")).toBe(true);
    // Active preset → no system prefix
    for (const s of sections) expect(s.systemName).toBeUndefined();
  });

  it("falls back to all systems when no active preset", () => {
    const all = listSystems();
    const sections = buildPickerSections({
      activeSystem: null,
      allSystems: all,
      inventory: [],
      query: "",
    });
    // Multiple systems → at least 2 distinct system prefixes show up.
    const systemNames = new Set(sections.map((s) => s.systemName).filter(Boolean));
    expect(systemNames.size).toBeGreaterThan(1);
  });

  it("filters by case-insensitive substring on label/code/dimension", () => {
    const sys = getSystem("lionel-fastrack")!;
    const sections = buildPickerSections({
      activeSystem: sys,
      allSystems: [sys],
      inventory: [],
      query: "STRAIGHT",
    });
    // Every surviving item should mention "straight" somewhere.
    const items = sections.flatMap((s) => s.items);
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      const hay = `${it.label} ${it.dimension} ${it.product_code ?? ""}`.toLowerCase();
      expect(hay.includes("straight")).toBe(true);
    }
    // And case-insensitivity confirmed: "stRaiGHT" matches the same set.
    const sections2 = buildPickerSections({
      activeSystem: sys,
      allSystems: [sys],
      inventory: [],
      query: "stRaiGHT",
    });
    expect(sections2.flatMap((s) => s.items).length).toBe(items.length);
  });

  it("annotates picker items with existingQty when the row is already owned", () => {
    const sys = getSystem("lionel-fastrack")!;
    // Build an inventory holding three of the 10" straight.
    const ten = sys.pieces.find((p) => p.id === "10in-straight");
    expect(ten).toBeDefined();
    const ownedRow = pieceToInventoryRow(ten!, sys)!;
    ownedRow.qty = 3;

    const sections = buildPickerSections({
      activeSystem: sys,
      allSystems: [sys],
      inventory: [ownedRow],
      query: "",
    });
    const items = sections.flatMap((s) => s.items);
    const owned = items.find((it) => it.row.label === ten!.label);
    expect(owned?.existingQty).toBe(3);
    // Pieces NOT in inventory have no badge.
    const unowned = items.find((it) => it.row.label !== ten!.label);
    expect(unowned?.existingQty).toBeUndefined();
  });
});

describe("piece-picker — dedupe and bump", () => {
  it("inventoryRowSignature is stable across labels but varies on geometry", () => {
    const a = makeStraightRow("10 in straight", 254);
    const b = makeStraightRow("Renamed by user", 254);
    const c = makeStraightRow("10 in straight", 228.6);
    expect(inventoryRowSignature(a)).toBe(inventoryRowSignature(b));
    expect(inventoryRowSignature(a)).not.toBe(inventoryRowSignature(c));
  });

  it("findInventoryDuplicate finds geometric matches even after rename", () => {
    const inv = [makeStraightRow("Stevie's favorite straight", 254, 4)];
    const incoming = makeStraightRow("10 in straight", 254, 1);
    expect(findInventoryDuplicate(inv, incoming)).toBe(0);
  });

  it("findInventoryDuplicate returns -1 when no row matches", () => {
    const inv = [makeStraightRow("9 in straight", 228.6, 4)];
    const incoming = makeStraightRow("10 in straight", 254, 1);
    expect(findInventoryDuplicate(inv, incoming)).toBe(-1);
  });

  it("addOrBump bumps the existing row's qty by 1 instead of appending", () => {
    const inv = [makeStraightRow("9 in", 228.6, 2), makeStraightRow("10 in", 254, 4)];
    const incoming = makeStraightRow("10 in", 254, 1);
    const { next, affectedIndex, bumped } = addOrBump(inv, incoming);
    expect(bumped).toBe(true);
    expect(affectedIndex).toBe(1);
    expect(next.length).toBe(2);
    expect(next[1]!.qty).toBe(5);
  });

  it("addOrBump appends a fresh row when nothing matches", () => {
    const inv = [makeStraightRow("9 in", 228.6, 2)];
    const incoming = makeStraightRow("10 in", 254, 4);
    const { next, affectedIndex, bumped } = addOrBump(inv, incoming);
    expect(bumped).toBe(false);
    expect(affectedIndex).toBe(1);
    expect(next.length).toBe(2);
    expect(next[1]!.qty).toBe(4);
  });

  it("addOrBump treats an incoming qty of 0 as 1 (defensive against DEFAULT_PRESET_QTY drift)", () => {
    const incoming: InventoryRow = {
      label: "Edge case",
      length_mm: 100,
      qty: 0,
      photo: null,
      kind: "straight",
    };
    const { next, bumped } = addOrBump([], incoming);
    expect(bumped).toBe(false);
    expect(next.length).toBe(1);
    expect(next[0]!.qty).toBe(1);
  });

  it("dedupe distinguishes curves from straights with the same arc length", () => {
    const sys = getSystem("lionel-fastrack")!;
    // A curved piece's length_mm equals r * arc (rad). Construct a
    // straight with that exact length and confirm the picker treats
    // them as different rows — kind is part of the signature.
    const curve = sys.pieces.find((p) => p.kind === "curve");
    expect(curve).toBeDefined();
    const curveRow = pieceToInventoryRow(curve!, sys)!;
    const straightRow: InventoryRow = {
      label: "fake straight same length",
      length_mm: curveRow.length_mm,
      qty: 1,
      photo: null,
      kind: "straight",
    };
    expect(findInventoryDuplicate([curveRow], straightRow)).toBe(-1);
  });

  it("dedupe distinguishes turnouts by overall_length and frog", () => {
    const a: InventoryRow = {
      label: "#4 turnout L",
      length_mm: 0,
      qty: 1,
      photo: null,
      kind: "turnout",
      overall_length_mm: 230,
      turnout_frog: "#4",
    };
    const b: InventoryRow = {
      label: "#6 turnout L",
      length_mm: 0,
      qty: 1,
      photo: null,
      kind: "turnout",
      overall_length_mm: 230,
      turnout_frog: "#6",
    };
    expect(findInventoryDuplicate([a], b)).toBe(-1);
  });
});

describe("piece-picker — pieceToInventoryRow", () => {
  it("produces a row with the same shape preset loading would", () => {
    const sys = getSystem("lionel-fastrack")!;
    const ten = sys.pieces.find((p) => p.id === "10in-straight")!;
    const row = pieceToInventoryRow(ten, sys);
    expect(row).not.toBeNull();
    expect(row!.kind).toBe("straight");
    expect(row!.length_mm).toBeCloseTo(254, 3);
    expect(row!.qty).toBeGreaterThan(0);
    expect(row!.photo).toBeNull();
  });

  it("returns null for placeholder pieces with no usable size", () => {
    // synthetic piece with no length and no curve geometry and not structural
    const fake = {
      id: "x",
      product_code: null,
      label: "placeholder",
      kind: "fitter" as const,
      length_mm: null,
      source_url: "https://example.com",
      source_verified_at: null,
    };
    const sys = getSystem("lionel-fastrack")!;
    expect(pieceToInventoryRow(fake, sys)).toBeNull();
  });

  it("derives arc length for curves from radius * arc", () => {
    const sys = getSystem("lionel-fastrack")!;
    const curve = sys.pieces.find((p) => p.kind === "curve");
    expect(curve).toBeDefined();
    if (
      typeof curve!.radius_mm !== "number" ||
      typeof curve!.arc_degrees !== "number"
    ) {
      return; // skip in the unlikely case the data is missing
    }
    const expected =
      curve!.radius_mm * curve!.arc_degrees * (Math.PI / 180);
    const row = pieceToInventoryRow(curve!, sys)!;
    // length_mm may be present in the JSON or derived; both should match within rounding.
    expect(row.length_mm).toBeCloseTo(
      typeof curve!.length_mm === "number" ? (curve!.length_mm as number) : expected,
      0,
    );
    expect(row.radius_mm).toBe(curve!.radius_mm);
    expect(row.arc_degrees).toBe(curve!.arc_degrees);
  });
});
