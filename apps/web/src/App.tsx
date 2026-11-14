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
import { LoopBuilder } from "./components/LoopBuilder";
import { Onboarding } from "./components/Onboarding";
import { StorageWarningToast } from "./components/StorageWarningToast";
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
import { formatLength, parseLengthExpression, unitSuffix } from "./lib/format";
import { chordToCurveTarget } from "./lib/curve-gap";
import { matchPresetId, presetToInventory, presetUnit } from "./lib/presets";
import { distinctScales, formatScales } from "./lib/scale-check";
import { isOnboarded, setOnboarded } from "./lib/prefs";
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

  // Mixed-scale guardrail. Different scales are different track gauges and
  // can't physically connect; the geometry-only solver wouldn't know that,
  // so we warn before it suggests an unbuildable combination. Dismissal is
  // keyed to the scale set, so it re-appears if the user mixes a new scale.
  const mixedScales = useMemo(() => distinctScales(inventory), [inventory]);
  const scaleSignature = mixedScales.join(",");
  const [dismissedScaleSig, setDismissedScaleSig] = useState<string | null>(
    null,
  );
  const showScaleNotice =
    mixedScales.length >= 2 && dismissedScaleSig !== scaleSignature;

  // Results state.
  const [results, setResults] = useState<ResultsState>({ kind: "idle" });
  const [solving, setSolving] = useState(false);
  /**
   * Wall-clock seconds since the current solve started. Drives the UI
   * counter ("Solving… 3s") and gates the moment we surface a Cancel
   * button. Null when no solve is in flight.
   */
  const [solveElapsedSec, setSolveElapsedSec] = useState<number | null>(null);
  const solveStartRef = useRef<number | null>(null);
  const solveTickRef = useRef<number | null>(null);

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

  // Photo capture pipelines — one for inventory rows, one for the gap.
  // Photos are purely mnemonic: they help the user tell two similar rows
  // apart and remember which gap they measured. Nothing is uploaded and
  // nothing is inferred from them.
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

  // Worker is recreatable: Cancel terminates the in-flight worker and
  // spins up a fresh one so the next solve starts cleanly. We track the
  // most recently dispatched request id so stale responses (rare, but
  // possible if the user re-submits before the previous solve finishes)
  // are ignored.
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const inflightIdRef = useRef<number | null>(null);

  // Spin up a new worker. Caller must terminate the old one first.
  const spawnWorker = () => {
    const worker = new SolverWorker();
    workerRef.current = worker;
    return worker;
  };

  useEffect(() => {
    spawnWorker();
    return () => {
      const worker = workerRef.current;
      if (worker) worker.terminate();
      workerRef.current = null;
      if (solveTickRef.current !== null) {
        window.clearInterval(solveTickRef.current);
        solveTickRef.current = null;
      }
    };
  }, []);

  /** Stop the current solve cleanly: terminate the worker, drop any
   *  in-flight request id, clear timers, reset UI to idle. The worker
   *  is replaced so the next Solve click starts from a clean slate. */
  const cancelSolve = () => {
    const worker = workerRef.current;
    if (worker) worker.terminate();
    workerRef.current = null;
    spawnWorker();
    inflightIdRef.current = null;
    if (solveTickRef.current !== null) {
      window.clearInterval(solveTickRef.current);
      solveTickRef.current = null;
    }
    solveStartRef.current = null;
    setSolveElapsedSec(null);
    setSolving(false);
    setResults({ kind: "idle" });
  };

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
  /* Photo flow                                                         */
  /* ------------------------------------------------------------------ */

  const handleRowPhotoClick = (idx: number) => {
    const item = inventory[idx];
    if (!item) return;
    if (item.photo) {
      setModalCtx({ kind: "row", idx });
    } else {
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
    // v0.3.3 — accept "47cm" / "47 cm" / "470mm" / "18in" suffixes on the
    // raw input strings. UK/European modellers (focus-group P4 Frank) think
    // in centimetres and silently break when entering "47" with unit=mm.
    // The suffix overrides the unit toggle for that field; bare numbers
    // continue to use the unit toggle as before.
    const targetParsed = parseLengthExpression(target, unit);
    const tolParsed = parseLengthExpression(tolerance, unit);
    const targetVal = targetParsed?.valueInUnit ?? NaN;
    const tolVal = tolParsed?.valueInUnit ?? 0;

    if (!targetVal || targetVal <= 0) {
      setResults({
        kind: "message",
        title: "How long is the gap?",
        text: `Type the gap's length in the length box (in ${unit === "in" ? "inches" : "millimetres"}, or add "cm"), then try again.`,
      });
      return;
    }

    const target_mm = targetParsed?.mm ?? (unit === "in" ? targetVal * IN_TO_MM : targetVal);
    const tolerance_mm = tolParsed?.mm ?? (unit === "in" ? tolVal * IN_TO_MM : tolVal);

    // The 1D and 2D solvers accept different inventory shapes. We always
    // filter to straights + curves only — turnouts/crossings live in the
    // box but don't participate in the search yet (TODO(turnouts)).
    const worker = workerRef.current;
    if (!worker) return;

    const id = ++reqIdRef.current;
    inflightIdRef.current = id;
    setSolving(true);
    // Kick off the elapsed-time counter. Updates once a second so the
    // user sees "Solving… 1s, 2s, 3s…" and the Cancel button surfaces
    // after 2 seconds. We don't try for sub-second granularity — older
    // eyes don't appreciate a flickering counter.
    solveStartRef.current = Date.now();
    setSolveElapsedSec(0);
    if (solveTickRef.current !== null) {
      window.clearInterval(solveTickRef.current);
    }
    solveTickRef.current = window.setInterval(() => {
      const start = solveStartRef.current;
      if (start === null) return;
      setSolveElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);

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
          // Pass through the source-system attribution so the SUGGESTED
          // callout's marketplace expander can route by per-row brand
          // rather than guessing from label-match counts (focus-group
          // P2-T2-F3). The solver's InventoryItem accepts arbitrary
          // pass-through metadata via its index signature.
          system_id: row.system_id,
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
              system_id: row.system_id,
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
              system_id: row.system_id,
            };
          }
          return {
            label: row.label,
            kind: "straight" as const,
            length_mm: row.length_mm,
            qty: row.qty,
            system_id: row.system_id,
          };
        });

      let curveTarget: CurveTarget;
      if (gapShape === "curve") {
        const arc = parseFloat(gapArcDegrees);
        if (!arc || Math.abs(arc) <= 0) {
          // Curved gap with no turn given: say so, and stop the clock
          // that solve() already started.
          setSolving(false);
          inflightIdRef.current = null;
          if (solveTickRef.current !== null) {
            window.clearInterval(solveTickRef.current);
            solveTickRef.current = null;
          }
          solveStartRef.current = null;
          setSolveElapsedSec(null);
          setResults({
            kind: "message",
            title: "How much does the gap turn?",
            text: "For a curved gap, tap how much it turns (for example a twelfth of a circle, 30°) or type the degrees, then try again.",
          });
          return;
        }
        // The user measures the chord (end to end) and the turn.
        curveTarget = chordToCurveTarget(target_mm, arc);
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
        // 8-second wall-clock budget. The solver returns whatever
        // bestNearMiss it has at that point with timed_out: true; the
        // results card surfaces a "search ran out of time" note. The
        // feasibility pre-check fires in microseconds so an
        // unreachable target never even arms this timer.
        maxElapsedMs: 8000,
      };
    }

    const onMessage = (e: MessageEvent<SolverResponse>) => {
      const msg = e.data;
      // Drop stale responses (user re-submitted before this one finished).
      if (msg.id !== inflightIdRef.current) return;
      worker.removeEventListener("message", onMessage);
      inflightIdRef.current = null;
      setSolving(false);
      // Stop the elapsed-time counter cleanly. We keep the value
      // displayed so the user sees "solved in 4s" momentarily before
      // the results card replaces the spinner; the next solve() call
      // resets it.
      if (solveTickRef.current !== null) {
        window.clearInterval(solveTickRef.current);
        solveTickRef.current = null;
      }
      solveStartRef.current = null;
      setSolveElapsedSec(null);

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
        // Feasibility pre-check OR pure dead-end: the solver has no
        // solutions AND no near-miss to surface. If the solver still
        // returned a typed suggestion (the "your inventory can't span
        // this" case), pass it through so the results card renders the
        // helpful sentence instead of the generic empty state.
        if (result.solutions.length === 0 && !result.bestNearMiss) {
          if (result.suggestion) {
            setResults({
              kind: "results",
              mode: "curve",
              result,
              target_mm,
              elapsed: msg.elapsed_ms.toFixed(1),
              inventory,
            });
          } else {
            setResults({ kind: "empty", targetVal });
          }
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
          <p className="label">Step 1 · Your track</p>
          <PresetChips
            activeId={
              activePresetId ??
              // After counts change the list no longer matches a fresh
              // preset, but it is still that brand: keep it named.
              (() => {
                const ids = new Set(inventory.map((r) => r.system_id));
                return ids.size === 1 ? ([...ids][0] ?? null) : null;
              })()
            }
            onSelect={(sys) => loadPreset(sys)}
          />
        </section>

        <InventoryList
          rows={inventory}
          unit={unit}
          activeSystem={
            activePresetId
              ? listSystems().find((s) => s.id === activePresetId) ?? null
              : null
          }
          allSystems={listSystems()}
          onPhotoClick={handleRowPhotoClick}
          onChange={updateField}
          onDelete={remove}
          onAdd={add}
          onReset={handleReset}
          onShowIntro={handleShowIntro}
          onZeroAll={() =>
            resetInventory(
              inventory.map((r) => ({ ...r, qty: 0 })),
              "Set every count to 0.",
            )
          }
        />

        {showScaleNotice ? (
          <p className="suggest-warning" role="status">
            Heads up — your inventory mixes {formatScales(mixedScales)} track.
            Those are different track gauges, so the pieces don&apos;t connect
            to each other and some suggested combinations may not physically
            fit together.{" "}
            <button
              type="button"
              className="suggest-warning__dismiss"
              onClick={() => setDismissedScaleSig(scaleSignature)}
            >
              Got it
            </button>
          </p>
        ) : null}

        <LoopBuilder inventory={inventory} unit={unit} />

        <GapCard
          gapPhoto={gapPhoto}
          target={target}
          tolerance={tolerance}
          unit={unit}
          gapShape={gapShape}
          gapArcDegrees={gapArcDegrees}
          gapOffset={gapOffset}
          solving={solving}
          solveElapsedSec={solveElapsedSec}
          onCancel={cancelSolve}
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
            More layout ideas (a rough guide) →
          </button>
        </section>

        <ResultsList
          state={results}
          unit={unit}
          flexCandidates={flexCandidates}
        />

        <footer className="app-footer">
          <p className="app-footer__tip">
            Save a backup of your list, print it, or make the text bigger:
            tap the gear at the top of the page.
          </p>
          <p>Trackfit · a Sky Wolf Studio tool</p>
          <p>
            Everything you enter stays on this device.{" "}
            <a href="./privacy.html">Privacy</a>
          </p>
        </footer>
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

      {toast ? (
        <UndoToast
          toastId={toast.id}
          message={toast.message}
          onUndo={undo}
          onDismiss={clearToast}
        />
      ) : null}

      {/* Storage-quota safety net. Listens for the global
          trackfit:storage-warning event fired from safeSetItem call
          sites and surfaces a one-time toast with concrete copy.
          See lib/storage.ts and components/StorageWarningToast.tsx. */}
      <StorageWarningToast />

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
