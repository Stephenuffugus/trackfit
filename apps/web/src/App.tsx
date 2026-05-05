import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CurveInventoryItem,
  CurveSolverResult,
  CurveTarget,
  CurveTolerance,
  InventoryItem,
  SolverResult,
} from "@trackfit/solver";
import { listSystems, type TrackSystem } from "@trackfit/library";
import { Header } from "./components/Header";
import { PresetChips } from "./components/PresetChips";
import { InventoryList } from "./components/InventoryList";
import { GapCard } from "./components/GapCard";
import { ResultsList, type ResultsState } from "./components/ResultsList";
import { PhotoModal } from "./components/PhotoModal";
import { GapMeasureOverlay } from "./components/measure/GapMeasureOverlay";
import { LayoutSuggester } from "./components/LayoutSuggester";
import { Onboarding } from "./components/Onboarding";
import { CandidateConfirmSheet } from "./components/CandidateConfirmSheet";
import { UndoToast } from "./components/UndoToast";
import { useUndoableInventory } from "./hooks/useUndoableInventory";
import { usePhotoCapture } from "./hooks/usePhotoCapture";
import {
  clearPersisted,
  loadPersisted,
  usePersistedState,
} from "./hooks/usePersistedState";
import {
  DEFAULT_CURVE_TOL_ANGLE_DEG,
  DEFAULT_CURVE_TOL_LATERAL_MM,
  DEFAULT_CURVE_TOL_LENGTH_MM,
  IN_TO_MM,
} from "./lib/constants";
import { formatLength, unitSuffix } from "./lib/format";
import { matchPresetId, presetToInventory, presetUnit } from "./lib/presets";
import { isOnboarded, loadPrefs, setOnboarded } from "./lib/prefs";
import {
  AUTO_FILL_CONFIDENCE_THRESHOLD,
  identifyPiece,
  type IdentifyCandidate,
} from "./lib/identify-piece";
import { consumePhotoIdQuota } from "./lib/premium";
import type { GapShape, InventoryRow, Unit } from "./lib/types";
import SolverWorker from "./workers/solver.worker.ts?worker";
import type { SolverRequest, SolverResponse } from "./workers/solver.worker";

type ModalContext =
  | { kind: "row"; idx: number }
  | { kind: "gap" }
  | null;

/**
 * Trackfit app shell. Owns the canonical state (unit, inventory, gapPhoto,
 * target, tolerance, gap shape) and threads it through the components.
 *
 * The solver runs in a Web Worker (apps/web/src/workers/solver.worker.ts) so
 * the curve solver — which can take up to ~1.8s on dense inventories — never
 * blocks scroll/touch on the phone. We track an in-flight request id so
 * stale responses get dropped if the user re-submits.
 */
export default function App() {
  // Initialize from localStorage if present, otherwise an EMPTY inventory.
  // (v0.3 design choice: don't surprise users by auto-loading a default
  // preset — let them pick.)
  const initial = useMemo(() => {
    const saved = loadPersisted();
    if (saved) return saved;
    return {
      unit: "in" as Unit,
      inventory: [] as InventoryRow[],
      gapPhoto: null as string | null,
      target: "",
      tolerance: "0",
      gap_shape: "straight" as GapShape,
      gap_arc_degrees: "",
      gap_offset: "",
    };
  }, []);

  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [inventory, setInventory] = useState<InventoryRow[]>(initial.inventory);
  const [gapPhoto, setGapPhoto] = useState<string | null>(initial.gapPhoto);
  const [target, setTarget] = useState<string>(initial.target);
  const [tolerance, setTolerance] = useState<string>(initial.tolerance);

  const [gapShape, setGapShape] = useState<GapShape>(
    (initial as { gap_shape?: GapShape }).gap_shape ?? "straight",
  );
  const [gapArcDegrees, setGapArcDegrees] = useState<string>(
    (initial as { gap_arc_degrees?: string }).gap_arc_degrees ?? "",
  );
  const [gapOffset, setGapOffset] = useState<string>(
    (initial as { gap_offset?: string }).gap_offset ?? "",
  );

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
  const [solving, setSolving] = useState(false);

  // Photo modal.
  const [modalCtx, setModalCtx] = useState<ModalContext>(null);

  // Reference-object measurement overlay.
  const [measureOpen, setMeasureOpen] = useState(false);

  // "What can I build with my inventory?" rule-based suggester modal.
  const [layoutSuggesterOpen, setLayoutSuggesterOpen] = useState(false);

  // First-run onboarding modal.
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(
    () => !isOnboarded(),
  );

  // The Layer-2 fake-door pricing test that previously sat here is
  // disabled — superseded by the Premium gate. The validation signal
  // is now "did the user click Upgrade?" rather than "did they pick a
  // price point on a survey?". The <PremiumPricingTest> component
  // stays on disk for possible re-use, but it no longer renders and
  // no window hook fires from the photo-ID path.

  // Photo capture pipelines — one for inventory rows, one for the gap.
  const rowCapture = usePhotoCapture();
  const gapCapture = usePhotoCapture();

  const {
    add,
    remove,
    updateField,
    setPhoto,
    resetInventory,
    undo,
    toast,
    clearToast,
  } = useUndoableInventory(inventory, setInventory, unit);

  // Persist on any state change (debounced 250ms inside the hook).
  usePersistedState({
    unit,
    inventory,
    gapPhoto,
    target,
    tolerance,
    gap_shape: gapShape,
    gap_arc_degrees: gapArcDegrees,
    gap_offset: gapOffset,
  });

  /* ------------------------------------------------------------------ */
  /* Solver worker                                                      */
  /* ------------------------------------------------------------------ */

  // Single long-lived worker. We track the most recently dispatched request
  // id so that stale responses (rare, but possible if the user re-submits
  // before the previous solve finishes) are ignored.
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const inflightIdRef = useRef<number | null>(null);

  useEffect(() => {
    const worker = new SolverWorker();
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Preset loading                                                     */
  /* ------------------------------------------------------------------ */

  const inventoryHasPhotos = () =>
    inventory.some((it) => !!it.photo) || !!gapPhoto;

  const loadPreset = (system: TrackSystem, opts?: { skipConfirm?: boolean }) => {
    if (!opts?.skipConfirm) {
      const hasInventory = inventory.length > 0;
      if (hasInventory) {
        const message = inventoryHasPhotos()
          ? `Replace your inventory with ${system.name}? Anything you've added or changed — including photos — will be lost.`
          : `Replace your inventory with ${system.name}? Anything you've added or changed will be lost.`;
        const ok = window.confirm(message);
        if (!ok) return;
      }
    }
    resetInventory(
      presetToInventory(system),
      `Replaced inventory with ${system.name}.`,
    );
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
    setGapPhoto(null);
    setGapShape("straight");
    setGapArcDegrees("");
    setGapOffset("");
    setResults({ kind: "idle" });
    resetInventory([], "Cleared your inventory.");
  };

  /* ------------------------------------------------------------------ */
  /* Onboarding                                                         */
  /* ------------------------------------------------------------------ */

  const handleOnboardingClose = () => {
    setOnboarded(true);
    setOnboardingOpen(false);
  };

  const handleShowIntro = () => {
    setOnboardingOpen(true);
  };

  /* ------------------------------------------------------------------ */
  /* Photo-ID flow                                                      */
  /* ------------------------------------------------------------------ */

  // True while the stub identifier is running. Surfaces a tiny
  // "Identifying…" toast at the bottom of the screen so the older user
  // sees something happening between snap and result. Per handoff §3
  // (never block the user) we keep the rest of the UI live.
  const [identifying, setIdentifying] = useState(false);

  // Candidate-confirm sheet state. Opens when the top-1 confidence
  // didn't clear AUTO_FILL_CONFIDENCE_THRESHOLD; the user picks one
  // (auto-fill happens) or punches out to manual entry.
  const [confirmSheet, setConfirmSheet] = useState<{
    rowIdx: number;
    photoSrc: string;
    candidates: IdentifyCandidate[];
  } | null>(null);

  /**
   * Apply a chosen candidate's specs onto an inventory row. We reach
   * past `updateField` (which only knows label/length/qty) and hit
   * setInventory directly so kind / radius / arc / product_code can
   * land in one atomic write.
   */
  const autoFillRowFromCandidate = (
    idx: number,
    c: IdentifyCandidate,
  ) => {
    setInventory((prev) => {
      const next = prev.slice();
      const row = next[idx];
      if (!row) return prev;
      const merged: InventoryRow = {
        ...row,
        label: c.label,
        length_mm: c.length_mm,
        kind: c.kind,
      };
      if (typeof c.radius_mm === "number") merged.radius_mm = c.radius_mm;
      if (typeof c.arc_degrees === "number") merged.arc_degrees = c.arc_degrees;
      if (c.product_code) merged.product_code = c.product_code;
      next[idx] = merged;
      return next;
    });
    // (Previously fired the Layer-2 pricing-test modal here. Disabled —
    // superseded by the Premium gate; the upgrade button click is now
    // the validation signal.)
  };

  // Tiny "quota left" toast shown after a successful auto-fill when
  // the user is on the trial. Cleared by a setTimeout so it doesn't
  // need its own component. Premium users never see this — quota is
  // Infinity for them.
  const [quotaToast, setQuotaToast] = useState<string | null>(null);

  /**
   * Run the (stubbed) identifier on a freshly-captured photo and
   * route the result. Top-1 ≥ threshold auto-fills silently; below
   * threshold opens the candidate-confirm sheet. Identification
   * failure is silent — the photo is already attached and the
   * existing manual-entry flow stays available (handoff §3).
   *
   * Photo-ID is a Premium feature with a 3-call lifetime free trial.
   * Each invocation consumes one slot via `consumePhotoIdQuota()`;
   * when the user is out, we open the upgrade modal instead. The
   * photo is already attached at the call site (see
   * `handleRowPhotoClick`) so the manual-entry path is unaffected
   * by the gate — handoff §3 ("never block the user") applies even
   * to gated features.
   */
  const runIdentifyOnRowPhoto = async (idx: number, photoDataUrl: string) => {
    const quota = consumePhotoIdQuota();
    if (!quota.allowed) {
      // Out of free trials — open the upgrade modal via the same
      // event the marketplace gate uses.
      window.dispatchEvent(new CustomEvent("trackfit:open-upgrade"));
      return;
    }
    setIdentifying(true);
    try {
      const result = await identifyPiece(photoDataUrl, { activePresetId });
      const top = result.candidates[0];
      if (!top) return;
      if (top.confidence >= AUTO_FILL_CONFIDENCE_THRESHOLD) {
        autoFillRowFromCandidate(idx, top);
      } else {
        setConfirmSheet({
          rowIdx: idx,
          photoSrc: photoDataUrl,
          candidates: result.candidates,
        });
      }
      // After a successful (auto or sheet-routed) call, surface a
      // tiny "X free photo-IDs left" hint when we're between full and
      // empty. Shown for ~2.5s — long enough to register but short
      // enough not to block the next photo. Premium users have
      // remaining=Infinity and skip this entirely.
      if (
        Number.isFinite(quota.remaining) &&
        quota.remaining > 0 &&
        quota.remaining < quota.total
      ) {
        const msg = `${quota.remaining} free photo-ID${quota.remaining === 1 ? "" : "s"} left.`;
        setQuotaToast(msg);
        window.setTimeout(() => setQuotaToast(null), 2500);
      }
    } catch (err) {
      // Never block — the photo is already attached, manual entry works.
      console.error("Trackfit: photo identification failed", err);
    } finally {
      setIdentifying(false);
    }
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
      rowCapture.capture((dataUrl) => {
        setPhoto(idx, dataUrl);
        // Read prefs at capture time, not at render time, so a toggle
        // flipped while a photo dialog is open is honored.
        const prefs = loadPrefs();
        if (prefs.identify_on_capture) {
          // Fire-and-forget. The toast is the user-visible signal;
          // we don't await here so the inventory render isn't gated
          // on the stub's 600ms delay.
          void runIdentifyOnRowPhoto(idx, dataUrl);
        }
      });
    }
  };

  const handleConfirmSheetPick = (c: IdentifyCandidate) => {
    if (!confirmSheet) return;
    autoFillRowFromCandidate(confirmSheet.rowIdx, c);
    setConfirmSheet(null);
  };

  const handleConfirmSheetManual = () => {
    // No-op on the inventory: the photo stays, the row is unchanged,
    // and the user types the specs themselves. The sheet closes via
    // its own onClose call after this.
    setConfirmSheet(null);
  };

  const handleConfirmSheetClose = () => {
    setConfirmSheet(null);
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
  /* Reference-object measurement                                       */
  /* ------------------------------------------------------------------ */

  const handleMeasureClick = () => {
    if (!gapPhoto) return;
    setMeasureOpen(true);
  };

  const handleMeasured = (gap_mm: number) => {
    setTarget(parseFloat(gap_mm.toFixed(1)).toString());
    setUnit("mm");
    setMeasureOpen(false);
  };

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

    // The 1D and 2D solvers accept different inventory shapes. We always
    // filter to straights + curves only — turnouts/crossings live in the
    // box but don't participate in the search yet (TODO(turnouts)).
    const worker = workerRef.current;
    if (!worker) return;

    const id = ++reqIdRef.current;
    inflightIdRef.current = id;
    setSolving(true);

    let request: SolverRequest;
    if (gapShape === "straight") {
      // 1D path — only straights/fitters/flex contribute.
      const items: InventoryItem[] = inventory
        .filter((row) => {
          const k = row.kind;
          return k === undefined || k === "straight" || k === "fitter" || k === "flex";
        })
        .map((row) => ({
          label: row.label,
          length_mm: row.length_mm,
          qty: row.qty,
        }));
      request = {
        id,
        kind: "straight",
        items,
        target_mm,
        tolerance_mm,
      };
    } else {
      // 2D path — straights, curves, and turnouts. v1 turnout pathing treats a
      // turnout as a straight equivalent of length `overall_length_mm` along
      // the main route (the diverging route is NOT searched yet — see TODO(v2
      // turnout pathing) in packages/solver/src/curve.ts). Turnouts with no
      // published `overall_length_mm` are dropped here so the solver never
      // sees a zero-length piece.
      const items: CurveInventoryItem[] = inventory
        .filter((row) => {
          const k = row.kind;
          if (k === "turnout") {
            return (
              typeof row.overall_length_mm === "number" &&
              (row.overall_length_mm ?? 0) > 0
            );
          }
          return (
            k === "curve" ||
            k === undefined ||
            k === "straight" ||
            k === "fitter" ||
            k === "flex"
          );
        })
        .map((row) => {
          const isCurve =
            row.kind === "curve" &&
            typeof row.radius_mm === "number" &&
            typeof row.arc_degrees === "number";
          if (isCurve) {
            return {
              label: row.label,
              kind: "curve" as const,
              length_mm: row.length_mm,
              radius_mm: row.radius_mm as number,
              arc_degrees: row.arc_degrees as number,
              qty: row.qty,
            };
          }
          if (row.kind === "turnout") {
            const overall = row.overall_length_mm as number;
            return {
              label: row.label,
              kind: "turnout" as const,
              // length_mm carries the through-route length so any consumer that
              // still treats the piece as a straight gets the right number.
              length_mm: overall,
              overall_length_mm: overall,
              divergence_degrees: row.divergence_degrees ?? null,
              qty: row.qty,
            };
          }
          return {
            label: row.label,
            kind: "straight" as const,
            length_mm: row.length_mm,
            qty: row.qty,
          };
        });

      let curveTarget: CurveTarget;
      if (gapShape === "curve") {
        const arc = parseFloat(gapArcDegrees);
        if (!arc || Math.abs(arc) <= 0) {
          // Curve gap with no arc set — treat as straight target so we still
          // give the user *something* (rather than failing silently).
          setSolving(false);
          inflightIdRef.current = null;
          setResults({ kind: "empty", targetVal });
          return;
        }
        const arcRad = (arc * Math.PI) / 180;
        // Lateral offset for a chord across an arc of θ centered on the
        // chord midpoint: chord · (1 − cos θ) / 2. Sign matches the sign of
        // the arc (positive = left turn, per the solver convention).
        const lateral = (target_mm * (1 - Math.cos(arcRad))) / 2;
        curveTarget = {
          length_mm: target_mm,
          lateral_offset_mm: lateral,
          angle_degrees: arc,
        };
      } else {
        // offset / S-curve: net angle 0, lateral = user input (in display unit)
        const offsetVal = parseFloat(gapOffset) || 0;
        const offset_mm = unit === "in" ? offsetVal * IN_TO_MM : offsetVal;
        curveTarget = {
          length_mm: target_mm,
          lateral_offset_mm: offset_mm,
          angle_degrees: 0,
        };
      }

      // Fan the user's single "wiggle room" mm value out across length and
      // lateral; angle keeps a fixed sub-degree default since it's not user-
      // exposed in v1. If the user typed 0 we still want a tiny floor so the
      // solver's tolerance-normalized score doesn't divide by zero.
      const lengthTol =
        Math.max(tolerance_mm, DEFAULT_CURVE_TOL_LENGTH_MM) ||
        DEFAULT_CURVE_TOL_LENGTH_MM;
      const lateralTol =
        Math.max(tolerance_mm, DEFAULT_CURVE_TOL_LATERAL_MM) ||
        DEFAULT_CURVE_TOL_LATERAL_MM;
      const curveTol: CurveTolerance = {
        length_mm: lengthTol,
        lateral_offset_mm: lateralTol,
        angle_degrees: DEFAULT_CURVE_TOL_ANGLE_DEG,
      };

      request = {
        id,
        kind: "curve",
        items,
        target: curveTarget,
        tolerance: curveTol,
      };
    }

    const onMessage = (e: MessageEvent<SolverResponse>) => {
      const msg = e.data;
      // Drop stale responses (user re-submitted before this one finished).
      if (msg.id !== inflightIdRef.current) return;
      worker.removeEventListener("message", onMessage);
      inflightIdRef.current = null;
      setSolving(false);

      if (!msg.ok) {
        console.error("Trackfit: solver worker error", msg.error);
        setResults({ kind: "empty", targetVal });
        return;
      }

      if (msg.kind === "straight") {
        const result = msg.result as SolverResult;
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
          mode: "straight",
          result,
          target_mm,
          elapsed: msg.elapsed_ms.toFixed(1),
          inventory,
        });
      } else {
        const result = msg.result as CurveSolverResult;
        if (result.solutions.length === 0 && !result.bestNearMiss) {
          setResults({ kind: "empty", targetVal });
          return;
        }
        setResults({
          kind: "results",
          mode: "curve",
          result,
          target_mm,
          elapsed: msg.elapsed_ms.toFixed(1),
          inventory,
        });
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage(request);
  };

  /* ------------------------------------------------------------------ */
  /* Derived: flex pieces the user owns                                 */
  /* ------------------------------------------------------------------ */

  const flexCandidates = useMemo(
    () =>
      inventory
        .filter(
          (row) =>
            row.kind === "flex" ||
            (row.kind === undefined && /flex/i.test(row.label)),
        )
        .map((row) => ({ label: row.label, length_mm: row.length_mm })),
    [inventory],
  );

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <>
      <div className="wrap">
        <Header inventory={inventory} />

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
          onShowIntro={handleShowIntro}
        />

        <GapCard
          gapPhoto={gapPhoto}
          target={target}
          tolerance={tolerance}
          unit={unit}
          gapShape={gapShape}
          gapArcDegrees={gapArcDegrees}
          gapOffset={gapOffset}
          solving={solving}
          onPhotoClick={handleGapPhotoClick}
          onTargetChange={setTarget}
          onToleranceChange={setTolerance}
          onUnitChange={setUnit}
          onShapeChange={setGapShape}
          onArcChange={setGapArcDegrees}
          onOffsetChange={setGapOffset}
          onSolve={solve}
          onMeasureClick={handleMeasureClick}
        />

        <section className="app-section layout-suggester-cta-section">
          <button
            type="button"
            className="btn layout-suggester-cta"
            onClick={() => setLayoutSuggesterOpen(true)}
          >
            What can I build with my inventory? →
          </button>
        </section>

        <ResultsList
          state={results}
          unit={unit}
          flexCandidates={flexCandidates}
        />

        <footer className="app-footer">TRACKFIT v0.3 · prototype</footer>
      </div>

      <PhotoModal
        open={modalCtx !== null}
        src={modalSrc}
        label={modalLabel}
        sizeText={modalSizeText}
        onClose={closeModal}
        onRemove={removeModalPhoto}
      />

      <GapMeasureOverlay
        open={measureOpen}
        photoSrc={gapPhoto}
        onMeasured={handleMeasured}
        onClose={() => setMeasureOpen(false)}
      />

      <LayoutSuggester
        open={layoutSuggesterOpen}
        inventory={inventory}
        onClose={() => setLayoutSuggesterOpen(false)}
      />

      <Onboarding open={onboardingOpen} onClose={handleOnboardingClose} />

      {/* PremiumPricingTest disabled — superseded by Premium gate. The
          file is preserved on disk for possible reuse. */}

      <CandidateConfirmSheet
        open={confirmSheet !== null}
        candidates={confirmSheet?.candidates ?? []}
        photoSrc={confirmSheet?.photoSrc ?? null}
        onPick={handleConfirmSheetPick}
        onManual={handleConfirmSheetManual}
        onClose={handleConfirmSheetClose}
      />

      {identifying ? (
        <div
          className="identify-toast"
          role="status"
          aria-live="polite"
        >
          <span className="identify-toast__spinner" aria-hidden="true" />
          Identifying…
        </div>
      ) : null}

      {quotaToast && !identifying ? (
        // Reuses the .identify-toast surface (a small bottom-anchored
        // pill) so the photo-ID UX stays in one visual register.
        <div className="identify-toast" role="status" aria-live="polite">
          {quotaToast}
        </div>
      ) : null}

      {toast ? (
        <UndoToast
          toastId={toast.id}
          message={toast.message}
          onUndo={undo}
          onDismiss={clearToast}
        />
      ) : null}

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
