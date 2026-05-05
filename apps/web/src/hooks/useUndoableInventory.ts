import { useCallback, useRef, useState } from "react";
import { IN_TO_MM } from "../lib/constants";
import type { InventoryRow, Unit } from "../lib/types";

const MAX_UNDO_STACK = 10;

export interface UndoToast {
  /** Increments every time a new toast is shown — keys the timer. */
  id: number;
  /** Plain-English label, e.g. "Removed '10\" straight'." */
  message: string;
  /** Snapshot to restore if the user clicks Undo. */
  snapshot: InventoryRow[];
}

/**
 * Drop-in replacement for useInventory that wraps every destructive
 * action with an undo snapshot.
 *
 * Returns the same {add, remove, updateField, setPhoto} surface plus:
 *   - resetInventory(rows): replace the inventory wholesale (with undo)
 *   - undo(): pops the most recent snapshot and restores it
 *   - toast: the most recent UndoToast (or null)
 *   - clearToast(): hide the toast immediately (e.g. after timeout)
 *
 * Only "destructive" actions push onto the stack:
 *   - remove (delete a row)
 *   - resetInventory (load a different preset, full reset)
 *
 * Edits to a single field don't push — that would surface a toast on
 * every keystroke and the user can already correct typing in place.
 */
export function useUndoableInventory(
  inventory: InventoryRow[],
  setInventory: React.Dispatch<React.SetStateAction<InventoryRow[]>>,
  unit: Unit,
) {
  const stackRef = useRef<InventoryRow[][]>([]);
  const [toast, setToast] = useState<UndoToast | null>(null);
  const toastIdRef = useRef(0);

  const pushSnapshot = useCallback((snapshot: InventoryRow[]) => {
    stackRef.current.push(snapshot);
    if (stackRef.current.length > MAX_UNDO_STACK) {
      stackRef.current.shift();
    }
  }, []);

  const showToast = useCallback(
    (message: string, snapshot: InventoryRow[]) => {
      toastIdRef.current += 1;
      setToast({ id: toastIdRef.current, message, snapshot });
    },
    [],
  );

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  /* ------- non-destructive (no undo snapshot) ------- */

  const add = useCallback(() => {
    setInventory((prev) => [
      ...prev,
      { label: "New piece", length_mm: 0, qty: 1, photo: null },
    ]);
  }, [setInventory]);

  const updateField = useCallback(
    (idx: number, field: "label" | "length" | "qty", value: string) => {
      setInventory((prev) => {
        const next = prev.slice();
        const row = next[idx];
        if (!row) return prev;
        if (field === "label") {
          next[idx] = { ...row, label: value };
        } else if (field === "length") {
          const num = parseFloat(value) || 0;
          next[idx] = {
            ...row,
            length_mm: unit === "in" ? num * IN_TO_MM : num,
          };
        } else {
          next[idx] = {
            ...row,
            qty: Math.max(0, parseInt(value, 10) || 0),
          };
        }
        return next;
      });
    },
    [setInventory, unit],
  );

  const setPhoto = useCallback(
    (idx: number, photo: string | null) => {
      setInventory((prev) => {
        const next = prev.slice();
        const row = next[idx];
        if (!row) return prev;
        next[idx] = { ...row, photo };
        return next;
      });
    },
    [setInventory],
  );

  /* ------- destructive (snapshot + toast) ------- */

  const remove = useCallback(
    (idx: number) => {
      const removed = inventory[idx];
      pushSnapshot(inventory);
      setInventory((prev) => {
        const next = prev.slice();
        next.splice(idx, 1);
        return next;
      });
      const label = (removed?.label || "piece").trim() || "piece";
      showToast(`Removed "${label}".`, inventory);
    },
    [inventory, pushSnapshot, setInventory, showToast],
  );

  /**
   * Replace the whole inventory (preset load, reset). Always pushes
   * the prior state for undo, *unless* the prior state was empty —
   * a toast saying "Undo" with nothing to restore is just confusing.
   */
  const resetInventory = useCallback(
    (next: InventoryRow[], message: string) => {
      const prior = inventory;
      if (prior.length > 0) {
        pushSnapshot(prior);
        showToast(message, prior);
      }
      setInventory(next);
    },
    [inventory, pushSnapshot, setInventory, showToast],
  );

  const undo = useCallback(() => {
    const snapshot = stackRef.current.pop();
    if (!snapshot) return;
    setInventory(snapshot);
    setToast(null);
  }, [setInventory]);

  return {
    add,
    remove,
    updateField,
    setPhoto,
    resetInventory,
    undo,
    toast,
    clearToast,
  };
}
