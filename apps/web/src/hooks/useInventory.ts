import { useCallback } from "react";
import { IN_TO_MM } from "../lib/constants";
import type { InventoryRow, Unit } from "../lib/types";

/**
 * Mutators around the inventory array. State itself lives in App so it can
 * be persisted as part of the unified PersistedState.
 *
 * Updates use the React functional-setter form so async callbacks (notably
 * the photo capture pipeline) can't clobber an interleaved edit.
 */
export function useInventory(
  setInventory: React.Dispatch<React.SetStateAction<InventoryRow[]>>,
  unit: Unit,
) {
  const add = useCallback(() => {
    setInventory((prev) => [
      ...prev,
      { label: "New piece", length_mm: 0, qty: 1, photo: null },
    ]);
  }, [setInventory]);

  const remove = useCallback(
    (idx: number) => {
      setInventory((prev) => {
        const next = prev.slice();
        next.splice(idx, 1);
        return next;
      });
    },
    [setInventory],
  );

  const updateField = useCallback(
    (idx: number, field: "label" | "length" | "qty", value: string) => {
      setInventory((prev) => {
        const next = prev.slice();
        const row = next[idx];
        if (!row) return prev;
        if (field === "label") {
          next[idx] = { ...row, label: value };
        } else if (field === "length") {
          // Curves, turnouts, and crossings derive their length from
          // catalog geometry (radius·arc, frog/divergence). The InventoryRow
          // renders these as read-only, but defend the data layer too —
          // ignore writes to length on non-straight rows.
          const editable =
            row.kind === undefined ||
            row.kind === "straight" ||
            row.kind === "fitter" ||
            row.kind === "flex";
          if (!editable) return prev;
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

  return { add, remove, updateField, setPhoto };
}
