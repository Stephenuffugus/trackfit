import type { CurveSolverResult, SolverResult } from "@trackfit/solver";
import { BAR_COLORS } from "../lib/constants";
import { unitSuffix } from "../lib/format";
import type { InventoryRow, Unit } from "../lib/types";
import { ResultCard } from "./ResultCard";

/**
 * Results state mirrors v0.2 with one twist: the `result` may be either the
 * 1D SolverResult (straight gap) or the 2D CurveSolverResult (curved/offset).
 * The discriminator is `mode`. Both shapes share `solutions`, but only the
 * curve one carries `bestNearMiss` + a typed `suggestion`.
 */
export type ResultsState =
  | { kind: "idle" }
  | { kind: "empty"; targetVal: number }
  | {
      kind: "results";
      mode: "straight";
      result: SolverResult;
      target_mm: number;
      elapsed: string;
      inventory: InventoryRow[];
    }
  | {
      kind: "results";
      mode: "curve";
      result: CurveSolverResult;
      target_mm: number;
      elapsed: string;
      inventory: InventoryRow[];
    };

interface Props {
  state: ResultsState;
  unit: Unit;
  /**
   * Flex inventory rows the user owns. Forwarded into each ResultCard so the
   * SUGGESTED near-miss callout can offer the 1:1 cut-template button when at
   * least one flex source is available.
   */
  flexCandidates: { label: string; length_mm: number }[];
}

/**
 * Render the results section under the gap card. Three modes:
 *   - idle: nothing solved yet (omitted entirely)
 *   - empty: target was missing/zero, or no fits and no near-misses
 *   - results: any combination of solutions / bestUnder / bestOver / bestNearMiss
 */
export function ResultsList({ state, unit, flexCandidates }: Props) {
  if (state.kind === "idle") {
    return <section className="results" id="results" />;
  }

  if (state.kind === "empty") {
    if (state.targetVal <= 0) {
      return (
        <section className="results" id="results">
          <div className="empty-state">
            Enter a target gap length to solve.
          </div>
        </section>
      );
    }
    return (
      <section className="results" id="results">
        <p className="label">No combinations found</p>
        <div className="empty-state">
          Nothing in your inventory comes close to {state.targetVal}
          {unitSuffix(unit)}.
          <br />
          Try adding pieces or shortening the target.
        </div>
      </section>
    );
  }

  const { result, target_mm, elapsed, inventory, mode } = state;

  // Stable color per piece label across this solve.
  const labelColors: Record<string, string> = {};
  inventory.forEach((it) => {
    if (!labelColors[it.label]) {
      const idx = Object.keys(labelColors).length % BAR_COLORS.length;
      labelColors[it.label] = BAR_COLORS[idx] as string;
    }
  });

  const solutions = result.solutions;

  if (solutions.length > 0) {
    return (
      <section className="results" id="results">
        <p className="label">
          {solutions.length} solution
          {solutions.length === 1 ? "" : "s"} · solved in {elapsed}ms
        </p>
        {solutions.map((sol, i) => (
          <ResultCard
            key={i}
            solution={sol}
            kind="fit"
            unit={unit}
            target_mm={target_mm}
            labelColors={labelColors}
            flexCandidates={flexCandidates}
          />
        ))}
      </section>
    );
  }

  // No solutions — fall back to near-miss surface.
  // 1D path uses bestUnder/bestOver; 2D path uses bestNearMiss + a suggestion.
  if (mode === "straight") {
    return (
      <section className="results" id="results">
        <p className="label">No exact fit · nearest options</p>
        {result.bestUnder ? (
          <ResultCard
            solution={result.bestUnder}
            kind="under"
            unit={unit}
            target_mm={target_mm}
            labelColors={labelColors}
            flexCandidates={flexCandidates}
          />
        ) : null}
        {result.bestOver ? (
          <ResultCard
            solution={result.bestOver}
            kind="over"
            unit={unit}
            target_mm={target_mm}
            labelColors={labelColors}
            flexCandidates={flexCandidates}
          />
        ) : null}
      </section>
    );
  }

  // Curve mode near-miss surface. Three situations to handle:
  //   1. We have a bestNearMiss — render the existing near-miss card +
  //      the typed suggestion. Most common case.
  //   2. No bestNearMiss but the solver returned a suggestion. This is
  //      either the feasibility pre-check ("your inventory can't span
  //      this gap") or a similar fast bail-out. Render the suggestion
  //      message in a calm empty-state — no near-miss card to show.
  //   3. Neither — fall back to the generic empty state.
  if (!result.bestNearMiss) {
    if (result.suggestion) {
      return (
        <section className="results" id="results">
          <p className="label">No combinations found</p>
          <div className="empty-state">{result.suggestion.message}</div>
        </section>
      );
    }
    return (
      <section className="results" id="results">
        <p className="label">No combinations found</p>
        <div className="empty-state">
          Nothing in your inventory comes close to this gap. Try a different
          shape or add curves to your box.
        </div>
      </section>
    );
  }
  const r_long = result.bestNearMiss.residual.length_mm;
  // Treat negative residual ("under") as the v0.2 "under" card so the
  // SUGGESTED missing-piece callout fires; positive ("over") falls through.
  const nearKind = r_long <= 0 ? "under" : "over";
  return (
    <section className="results" id="results">
      <p className="label">
        {result.timed_out
          ? "Search ran out of time · best guess so far"
          : "No exact fit · nearest options"}
      </p>
      {result.timed_out ? (
        <div className="empty-state results-timeout-note">
          The solver hit its 8-second budget before finding an exact fit.
          The closest combination it found is shown below. If the gap is
          really this hard, try breaking it into shorter segments or adding
          a longer flex piece to your inventory.
        </div>
      ) : null}
      <ResultCard
        solution={result.bestNearMiss}
        kind={nearKind}
        unit={unit}
        target_mm={target_mm}
        labelColors={labelColors}
        flexCandidates={flexCandidates}
        curveSuggestion={result.suggestion}
      />
    </section>
  );
}
