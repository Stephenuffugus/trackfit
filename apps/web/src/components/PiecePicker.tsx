import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackSystem } from "@trackfit/library";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  buildPickerSections,
  type PickerItem,
} from "../lib/piece-picker";
import type { InventoryRow } from "../lib/types";

interface Props {
  open: boolean;
  /**
   * The currently active preset, if any. When set, only that system's
   * pieces are surfaced (grouped by kind). When null, every system in
   * `allSystems` contributes (grouped by system + kind).
   */
  activeSystem: TrackSystem | null;
  allSystems: TrackSystem[];
  /**
   * The current inventory — used only to annotate picker entries with
   * "(in inventory: 4)" chips and to feed the dedupe-and-bump caller.
   * The picker itself is non-destructive.
   */
  inventory: InventoryRow[];
  onPick: (row: InventoryRow) => void;
  /**
   * Escape hatch — closes the picker and creates an empty manual row.
   * Per handoff §3, the manual-entry path must remain available.
   */
  onCustom: () => void;
  onClose: () => void;
}

/**
 * Picker modal for "Add piece". Opens from InventoryList; surfaces
 * the currently active preset's pieces (or every system's pieces if
 * no preset is active), grouped by kind, searchable, and with a clear
 * "Type a custom piece →" escape hatch.
 *
 * Design constraints (handoff §1, §3, §9):
 *   - Older audience → big tap targets, plain English, no jargon.
 *   - Never block the user → manual entry stays available.
 *   - Aesthetic is permission-gated → re-uses .modal / .modal-inner /
 *     .btn / .field-label tokens. No new colors, fonts, or shadows.
 *
 * The picker entries are 56px tall (matches the existing
 * .candidate-confirm__row idiom) — well above the WCAG 2.5.5 44px
 * floor.
 */
export function PiecePicker({
  open,
  activeSystem,
  allSystems,
  inventory,
  onPick,
  onCustom,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Reset the search box every time the picker re-opens — sticky
  // queries between sessions confused testers in the layout suggester
  // and the same logic applies here.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Focus trap + ESC + restore focus to the "Add piece" button. We
  // override the default first-focusable to land on the search box
  // (it's the first focusable, but being explicit documents intent).
  const trapRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    onEscape: onClose,
  });

  // The picker shape: array of { heading, items[] }. Memoized so a
  // 1000-piece all-systems render doesn't re-walk every keystroke.
  // The query is part of the deps so filtering re-runs on each keystroke.
  const sections = useMemo(
    () =>
      buildPickerSections({
        activeSystem,
        allSystems,
        inventory,
        query,
      }),
    [activeSystem, allSystems, inventory, query],
  );

  const totalItems = useMemo(
    () => sections.reduce((sum, s) => sum + s.items.length, 0),
    [sections],
  );

  if (!open) return null;

  return (
    <div
      ref={trapRef}
      className="modal open piece-picker"
      role="dialog"
      aria-modal="true"
      aria-label="Pick a piece to add to your inventory"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner piece-picker__inner">
        <div className="piece-picker__head">
          <h2>Add a piece</h2>
          <p className="hint">
            {activeSystem
              ? `Showing ${activeSystem.name} pieces. Tap one to add it; if you already have it, the count goes up by one.`
              : "Showing every track system. Pick a preset chip first to narrow this down."}
          </p>
        </div>

        <div className="piece-picker__search">
          <label className="field-label" htmlFor="piece-picker-search">
            Search
          </label>
          <input
            id="piece-picker-search"
            ref={searchRef}
            type="text"
            placeholder="e.g. 10 in, curve, #4, 6-12014"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="piece-picker__body">
          {totalItems === 0 ? (
            <div className="piece-picker__empty">
              {query
                ? `No pieces match "${query}".`
                : "No pieces to show."}
            </div>
          ) : (
            sections.map((section) => (
              <section
                key={section.key}
                className="piece-picker__section"
                aria-label={section.heading}
              >
                <h3 className="piece-picker__heading">{section.heading}</h3>
                <ul className="piece-picker__list">
                  {section.items.map((item) => (
                    <li key={item.key}>
                      <PickerEntry item={item} onPick={onPick} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="piece-picker__foot">
          <button
            type="button"
            className="btn"
            onClick={() => {
              onCustom();
            }}
          >
            Type a custom piece →
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface EntryProps {
  item: PickerItem;
  onPick: (row: InventoryRow) => void;
}

function PickerEntry({ item, onPick }: EntryProps) {
  return (
    <button
      type="button"
      className="piece-picker__entry"
      onClick={() => onPick(item.row)}
    >
      <span className="piece-picker__entry-text">
        <span className="piece-picker__entry-label">{item.label}</span>
        <span className="piece-picker__entry-dim">{item.dimension}</span>
        {item.product_code ? (
          <span className="piece-picker__entry-code">
            {item.product_code}
          </span>
        ) : null}
      </span>
      {typeof item.existingQty === "number" && item.existingQty > 0 ? (
        <span className="piece-picker__owned" aria-label={`Already in inventory: ${item.existingQty}`}>
          in inventory: {item.existingQty}
        </span>
      ) : null}
    </button>
  );
}
