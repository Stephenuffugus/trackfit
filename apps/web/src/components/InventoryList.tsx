import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackSystem } from "@trackfit/library";
import type { InventoryRow as Row, Unit } from "../lib/types";
import { groupKindOf, type PieceGroupKind } from "../lib/piece-picker";
import { formatLength } from "../lib/format";
import { InventoryRow } from "./InventoryRow";
import {
  bucketOf,
  InventoryFilters,
  type InventoryFilter,
} from "./InventoryFilters";
import { PiecePicker } from "./PiecePicker";

interface Props {
  rows: Row[];
  unit: Unit;
  /** Currently active preset, used to seed the picker with that system's pieces. */
  activeSystem: TrackSystem | null;
  /** All systems, surfaced by the picker when no preset is active. */
  allSystems: TrackSystem[];
  onPhotoClick: (idx: number) => void;
  onChange: (
    idx: number,
    field: "label" | "length" | "qty",
    value: string,
  ) => void;
  onDelete: (idx: number) => void;
  /**
   * Add a row. With no argument: empty manual row (the legacy "+ Add row"
   * path). With a row: the picker just landed a selection — the caller
   * applies dedupe-and-bump and returns the affected index so we can
   * scroll to it.
   */
  onAdd: (row?: Row) => number | null;
  onReset: () => void;
  onShowIntro: () => void;
}

/** Threshold above which the accordion auto-collapses non-recently-edited groups. */
const ACCORDION_AUTO_COLLAPSE_THRESHOLD = 8;

/** Group order matching the spec — Straights, Curves, Turnouts, Crossings, Other. */
const GROUP_ORDER: ReadonlyArray<{ kind: PieceGroupKind; label: string }> = [
  { kind: "straight", label: "Straights" },
  { kind: "curve", label: "Curves" },
  { kind: "turnout", label: "Turnouts" },
  { kind: "crossing", label: "Crossings" },
  { kind: "other", label: "Other" },
];

/**
 * Inventory section: header row + filter chips + collapsible kind-groups
 * + "Add piece" + text actions.
 *
 * The accordion is a stack of <details> elements (one per group), which
 * gives keyboard handling (Enter/Space toggle, ESC-to-collapse on
 * Firefox) and screen-reader semantics for free. We override `open`
 * with `<details open={...}>` so React owns the expansion state — the
 * spec mandates session-sticky-but-defaulted behavior:
 *
 *   - ≤ 8 rows: every group expanded.
 *   - > 8 rows: only the group containing the most-recently-edited
 *     row stays expanded; others collapse.
 *   - User toggles override the default and persist for the session.
 *
 * Aesthetic: handoff §9 — re-uses --rule, --ink-soft, --bg-elev. The
 * only new layout the CSS adds is `.inv-group-*` for the header bar
 * and chevron; no new colors or fonts.
 */
export function InventoryList({
  rows,
  unit,
  activeSystem,
  allSystems,
  onPhotoClick,
  onChange,
  onDelete,
  onAdd,
  onReset,
  onShowIntro,
}: Props) {
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Track the most-recently-edited row index. `useUndoableInventory`'s
  // updateField doesn't surface a change event, so we hook into the
  // `onChange` path here by wrapping it.
  const [recentEditIdx, setRecentEditIdx] = useState<number | null>(null);
  const wrappedOnChange = useMemo(
    () =>
      (idx: number, field: "label" | "length" | "qty", value: string) => {
        setRecentEditIdx(idx);
        onChange(idx, field, value);
      },
    [onChange],
  );

  // User toggles for the accordion (sticky for the session). Map of
  // group-kind → override boolean. Absence of an entry means
  // "use the default". Cleared on inventory reset only by the parent
  // unmounting/re-mounting the component.
  const [groupOverrides, setGroupOverrides] = useState<
    Partial<Record<PieceGroupKind, boolean>>
  >({});

  // Pre-compute bucket counts so the filter chips can show "Curves 6" etc.
  const counts = useMemo(() => {
    const c: Record<InventoryFilter, number> = {
      all: rows.length,
      straight: 0,
      curve: 0,
      turnout: 0,
      crossing: 0,
    };
    for (const r of rows) c[bucketOf(r.kind)]++;
    return c;
  }, [rows]);

  // Visible-after-filter set. Same trick as before: tag with original
  // index pre-filter so child callbacks operate on the right row.
  const visible = useMemo(() => {
    return rows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => filter === "all" || bucketOf(row.kind) === filter);
  }, [rows, filter]);

  // Group the visible rows into the five accordion buckets.
  const groups = useMemo(() => {
    const out: Record<PieceGroupKind, { row: Row; idx: number }[]> = {
      straight: [],
      curve: [],
      turnout: [],
      crossing: [],
      other: [],
    };
    for (const v of visible) out[groupKindOf(v.row.kind)].push(v);
    return out;
  }, [visible]);

  // Default-expansion logic, recomputed every render. Cheap; just
  // walks the five group-kinds.
  const recentGroup: PieceGroupKind | null =
    recentEditIdx !== null && rows[recentEditIdx]
      ? groupKindOf(rows[recentEditIdx].kind)
      : null;
  const hasManyRows = rows.length > ACCORDION_AUTO_COLLAPSE_THRESHOLD;

  const isGroupOpen = (kind: PieceGroupKind): boolean => {
    if (kind in groupOverrides) {
      return groupOverrides[kind] as boolean;
    }
    if (!hasManyRows) return true;
    // Many rows + no explicit override: only the recently-edited
    // group is open. If we don't know which one (no recent edit yet
    // this session), default the first non-empty group open so the
    // user sees something — otherwise they're staring at five
    // collapsed bars.
    if (recentGroup) return kind === recentGroup;
    const firstNonEmpty = GROUP_ORDER.find(
      (g) => groups[g.kind].length > 0,
    )?.kind;
    return firstNonEmpty === kind;
  };

  const toggleGroup = (kind: PieceGroupKind, next: boolean) => {
    setGroupOverrides((prev) => ({ ...prev, [kind]: next }));
  };

  // Picker callbacks. handlePick adds-or-bumps via the parent's onAdd;
  // handleCustom closes the picker and falls back to the legacy
  // empty-row path. Either way we keep the manual-entry escape hatch
  // open per handoff §3.
  const handlePick = (row: Row) => {
    const idx = onAdd(row);
    setPickerOpen(false);
    // Make the affected group's accordion section expand so the user
    // sees their just-added piece.
    if (idx !== null && rows[idx]) {
      const kind = groupKindOf(rows[idx].kind);
      setGroupOverrides((prev) => ({ ...prev, [kind]: true }));
    } else if (idx !== null) {
      // Row not yet in `rows` (state hasn't propagated this render).
      // Use the incoming row's kind directly.
      const kind = groupKindOf(row.kind);
      setGroupOverrides((prev) => ({ ...prev, [kind]: true }));
    }
    setRecentEditIdx(idx);
    // Defer the scroll one tick so the new row exists in the DOM.
    window.setTimeout(() => {
      const card = cardRef.current;
      if (!card) return;
      // Just scroll the card into view at the bottom — that's where
      // appended rows land. For a bumped row this still surfaces the
      // right region.
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);
  };

  const handleCustom = () => {
    setPickerOpen(false);
    onAdd();
  };

  // Defensive cleanup: if the inventory shrinks below the recent-edit
  // index (e.g. a row was deleted), forget the recent index so the
  // accordion doesn't try to default-expand a phantom group.
  useEffect(() => {
    if (recentEditIdx !== null && recentEditIdx >= rows.length) {
      setRecentEditIdx(null);
    }
  }, [rows.length, recentEditIdx]);

  return (
    <section className="app-section">
      <div className="label-row">
        <p className="label">What's in your box</p>
        <div className="text-actions">
          <button
            type="button"
            className="text-action"
            title="Replay the welcome cards"
            onClick={onShowIntro}
          >
            Show intro again
          </button>
          <button
            type="button"
            className="text-action"
            title="Clear your inventory and gap fields"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>
      <p className="section-subhead">
        What you have to work with. Tap a brand to load the standard pieces.
      </p>
      <InventoryFilters active={filter} counts={counts} onChange={setFilter} />
      <div className="card" ref={cardRef}>
        <div className="inv-row inv-head">
          <div>Photo</div>
          <div>Piece label</div>
          <div>Length</div>
          <div>Qty</div>
          <div />
        </div>
        {visible.length === 0 ? (
          <div className="inv-empty-filter">
            No {filter === "all" ? "pieces" : filter + "s"} in your box yet.
          </div>
        ) : (
          GROUP_ORDER.map(({ kind, label }) => {
            const items = groups[kind];
            if (items.length === 0) return null;
            const open = isGroupOpen(kind);
            const summary = summarizeGroup(items, kind, unit);
            return (
              <details
                key={kind}
                className="inv-group"
                data-kind={kind}
                open={open}
                onToggle={(e) => {
                  const t = e.currentTarget;
                  // Only react to actual user-driven toggles. React
                  // also fires onToggle when we set `open` ourselves,
                  // which would trample the override — bail early
                  // when the new state already matches the computed
                  // expected state.
                  if (t.open === isGroupOpen(kind)) return;
                  toggleGroup(kind, t.open);
                }}
              >
                <summary className="inv-group__head">
                  <span className="inv-group__chevron" aria-hidden="true">
                    {open ? "▼" : "▶"}
                  </span>
                  <span className="inv-group__label">{label}</span>
                  <span className="inv-group__summary">{summary}</span>
                </summary>
                <div className="inv-group__body">
                  {items.map(({ row, idx }) => (
                    <InventoryRow
                      key={idx}
                      idx={idx}
                      row={row}
                      unit={unit}
                      onPhotoClick={onPhotoClick}
                      onChange={wrappedOnChange}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </details>
            );
          })
        )}
        <button
          type="button"
          className="add-row"
          onClick={() => setPickerOpen(true)}
        >
          + Add piece
        </button>
      </div>

      <PiecePicker
        open={pickerOpen}
        activeSystem={activeSystem}
        allSystems={allSystems}
        inventory={rows}
        onPick={handlePick}
        onCustom={handleCustom}
        onClose={() => setPickerOpen(false)}
      />
    </section>
  );
}

/**
 * Summary line for a group header. Format:
 *   - Straights / Other: "(N owned · Ltotal)"
 *   - Curves: "(N owned · D° total)"
 *   - Turnouts / Crossings: "(N owned · M turnouts)" or "M crossings"
 * Where N is the sum of qty across the group and L/D/M is a length-or-count
 * measure that makes sense for the kind. "0 owned" if every row has qty 0.
 */
function summarizeGroup(
  items: { row: Row; idx: number }[],
  kind: PieceGroupKind,
  unit: Unit,
): string {
  const totalQty = items.reduce((sum, { row }) => sum + (row.qty ?? 0), 0);
  const ownedText = `${totalQty} owned`;

  if (kind === "curve") {
    const totalDeg = items.reduce(
      (sum, { row }) => sum + (row.arc_degrees ?? 0) * (row.qty ?? 0),
      0,
    );
    if (totalDeg <= 0) return `(${ownedText})`;
    return `(${ownedText} · ${Math.round(totalDeg)}° total)`;
  }
  if (kind === "turnout" || kind === "crossing") {
    const noun = kind === "turnout" ? "turnout" : "crossing";
    const distinct = items.length;
    const word = distinct === 1 ? noun : `${noun}s`;
    return `(${ownedText} · ${distinct} ${word})`;
  }
  // straight / other → length total
  const totalMm = items.reduce(
    (sum, { row }) => sum + (row.length_mm ?? 0) * (row.qty ?? 0),
    0,
  );
  if (totalMm <= 0) return `(${ownedText})`;
  return `(${ownedText} · ${formatLength(totalMm, unit)} ${unit} total)`;
}
