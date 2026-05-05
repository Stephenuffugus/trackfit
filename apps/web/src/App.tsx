import { useEffect, useMemo, useState } from "react";
import { findCombinations, type SolverResult } from "@trackfit/solver";
import { getSystem, listSystems, type TrackSystem } from "@trackfit/library";
import { Header } from "./components/Header";
import { PresetChips } from "./components/PresetChips";
import { InventoryList } from "./components/InventoryList";
import { GapCard } from "./components/GapCard";
import { ResultsList, type ResultsState } from "./components/ResultsList";
import { PhotoModal } from "./components/PhotoModal";
import { useInventory } from "./hooks/useInventory";
import { usePhotoCapture } from "./hooks/usePhotoCapture";
import {
  clearPersisted,
  loadPersisted,
  usePersistedState,
} from "./hooks/usePersistedState";
import { DEFAULT_PRESET_ID, IN_TO_MM } from "./lib/constants";
import { formatLength, unitSuffix } from "./lib/format";
import { matchPresetId, presetToInventory, presetUnit } from "./lib/presets";
import type { InventoryRow, Unit } from "./lib/types";

type ModalContext =
  | { kind: "row"; idx: number }
  | { kind: "gap" }
  | null;

/**
 * Trackfit app shell. Owns the canonical state (unit, inventory, gapPhoto,
 * target, tolerance) and threads it through the components. Persistence is
 * handled by usePersistedState — every state change debounces a write to
 * localStorage at the v0.2 key `trackfit.state.v1`.
 */
export default function App() {
  // Initialize from localStorage if present, otherwise default preset.
  const initial = useMemo(() => {
    const saved = loadPersisted();
    if (saved) return saved;
    const sys = getSystem(DEFAULT_PRESET_ID);
    if (!sys) {
      return {
        unit: "in" as Unit,
        inventory: [] as InventoryRow[],
        gapPhoto: null as string | null,
        target: "",
        tolerance: "0",
      };
    }
    return {
      unit: presetUnit(sys),
      inventory: presetToInventory(sys),
      gapPhoto: null as string | null,
      target: "",
      tolerance: "0",
    };
  }, []);

  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [inventory, setInventory] = useState<InventoryRow[]>(initial.inventory);
  const [gapPhoto, setGapPhoto] = useState<string | null>(initial.gapPhoto);
  const [target, setTarget] = useState<string>(initial.target);
  const [tolerance, setTolerance] = useState<string>(initial.tolerance);

  // Active preset chip, derived from inventory signature.
  const [activePresetId, setActivePresetId] = useState<string | null>(() =>
    matchPresetId(initial.inventory, listSystems()),
  );

  // Recompute the active chip whenever inventory changes — typing edits
  // shouldn't keep a stale chip lit.
  useEffect(() => {
    setActivePresetId(matchPresetId(inventory, listSystems()));
  }, [inventory]);

  // Results state.
  const [results, setResults] = useState<ResultsState>({ kind: "idle" });

  // Photo modal.
  const [modalCtx, setModalCtx] = useState<ModalContext>(null);

  // Photo capture pipelines — one for inventory rows, one for the gap.
  const rowCapture = usePhotoCapture();
  const gapCapture = usePhotoCapture();

  const { add, remove, updateField, setPhoto } = useInventory(
    setInventory,
    unit,
  );

  // Persist on any state change (debounced 250ms inside the hook).
  usePersistedState({ unit, inventory, gapPhoto, target, tolerance });

  /* ------------------------------------------------------------------ */
  /* Preset loading                                                     */
  /* ------------------------------------------------------------------ */

  const inventoryHasPhotos = () =>
    inventory.some((it) => !!it.photo) || !!gapPhoto;

  const loadPreset = (system: TrackSystem, opts?: { skipConfirm?: boolean }) => {
    if (!opts?.skipConfirm && inventoryHasPhotos()) {
      const ok = window.confirm(
        `Loading "${system.name}" will replace your current inventory and any photos you've added. Continue?`,
      );
      if (!ok) return;
    }
    setInventory(presetToInventory(system));
    setGapPhoto(null);
    setUnit(presetUnit(system));
    setActivePresetId(system.id);
    setResults({ kind: "idle" });
  };

  const handleReset = () => {
    const ok = window.confirm(
      "Reset everything? This clears your inventory, photos, and the gap.",
    );
    if (!ok) return;
    clearPersisted();
    setTarget("");
    setTolerance("0");
    setResults({ kind: "idle" });
    const sys = getSystem(DEFAULT_PRESET_ID);
    if (sys) loadPreset(sys, { skipConfirm: true });
  };

  /* ------------------------------------------------------------------ */
  /* Photo flow                                                         */
  /* ------------------------------------------------------------------ */

  const handleRowPhotoClick = (idx: number) => {
    const item = inventory[idx];
    if (!item) return;
    if (item.photo) {
      setModalCtx({ kind: "row", idx });
    } else {
      // Snapshot idx into the closure: useInventory's setPhoto reads from
      // current `inventory`, so by the time the user picks an image the
      // index is still valid.
      rowCapture.capture((dataUrl) => setPhoto(idx, dataUrl));
    }
  };

  const handleGapPhotoClick = () => {
    if (gapPhoto) {
      setModalCtx({ kind: "gap" });
    } else {
      gapCapture.capture((dataUrl) => setGapPhoto(dataUrl));
    }
  };

  const closeModal = () => setModalCtx(null);

  const removeModalPhoto = () => {
    if (!modalCtx) return;
    if (modalCtx.kind === "row") {
      setPhoto(modalCtx.idx, null);
    } else {
      setGapPhoto(null);
    }
    closeModal();
  };

  const modalSrc = (() => {
    if (!modalCtx) return null;
    if (modalCtx.kind === "row") return inventory[modalCtx.idx]?.photo ?? null;
    return gapPhoto;
  })();

  const modalLabel = (() => {
    if (!modalCtx) return "SPECIMEN";
    if (modalCtx.kind === "row") {
      const item = inventory[modalCtx.idx];
      return (item?.label || "SPECIMEN").toUpperCase();
    }
    return "GAP REFERENCE";
  })();

  const modalSizeText = (() => {
    if (!modalCtx) return "";
    if (modalCtx.kind === "row") {
      const item = inventory[modalCtx.idx];
      if (!item) return "";
      return `${formatLength(item.length_mm, unit)}${unitSuffix(unit)} · qty ${item.qty}`;
    }
    return target ? `target ${target}${unitSuffix(unit)}` : "";
  })();

  /* ------------------------------------------------------------------ */
  /* Solve                                                              */
  /* ------------------------------------------------------------------ */

  const solve = () => {
    const targetVal = parseFloat(target);
    const tolVal = parseFloat(tolerance) || 0;

    if (!targetVal || targetVal <= 0) {
      setResults({ kind: "empty", targetVal: 0 });
      return;
    }

    const target_mm = unit === "in" ? targetVal * IN_TO_MM : targetVal;
    const tolerance_mm = unit === "in" ? tolVal * IN_TO_MM : tolVal;

    const t0 = performance.now();
    const result: SolverResult = findCombinations(
      inventory,
      target_mm,
      tolerance_mm,
    );
    const elapsed = (performance.now() - t0).toFixed(1);

    if (
      result.solutions.length === 0 &&
      !result.bestUnder &&
      !result.bestOver
    ) {
      setResults({ kind: "empty", targetVal });
      return;
    }

    setResults({
      kind: "results",
      result,
      target_mm,
      elapsed,
      inventory,
    });
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <>
      <div className="wrap">
        <Header />

        <section className="app-section">
          <p className="label">Load a track system</p>
          <PresetChips
            activeId={activePresetId}
            onSelect={(sys) => loadPreset(sys)}
          />
        </section>

        <InventoryList
          rows={inventory}
          unit={unit}
          onPhotoClick={handleRowPhotoClick}
          onChange={updateField}
          onDelete={remove}
          onAdd={add}
          onReset={handleReset}
        />

        <GapCard
          gapPhoto={gapPhoto}
          target={target}
          tolerance={tolerance}
          unit={unit}
          onPhotoClick={handleGapPhotoClick}
          onTargetChange={setTarget}
          onToleranceChange={setTolerance}
          onUnitChange={setUnit}
          onSolve={solve}
        />

        <ResultsList state={results} unit={unit} />

        <footer className="app-footer">TRACKFIT v0.2 · prototype</footer>
      </div>

      <PhotoModal
        open={modalCtx !== null}
        src={modalSrc}
        label={modalLabel}
        sizeText={modalSizeText}
        onClose={closeModal}
        onRemove={removeModalPhoto}
      />

      {/* Hidden file inputs — single-instance like v0.2, re-routed via the
          usePhotoCapture hooks. */}
      <input
        ref={rowCapture.inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={rowCapture.onInputChange}
      />
      <input
        ref={gapCapture.inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={gapCapture.onInputChange}
      />
    </>
  );
}
