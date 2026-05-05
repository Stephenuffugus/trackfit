import type { SolverResult } from "@trackfit/solver";
import { BAR_COLORS } from "../lib/constants";
import { unitSuffix } from "../lib/format";
import type { InventoryRow, Unit } from "../lib/types";
import { ResultCard } from "./ResultCard";

export type ResultsState =
  | { kind: "idle" }
  | { kind: "empty"; targetVal: number }
  | {
      kind: "results";
      result: SolverResult;
      target_mm: number;
      elapsed: string;
      inventory: InventoryRow[];
    };

interface Props {
  state: ResultsState;
  unit: Unit;
}

/**
 * Render the results section under the gap card. Mirrors v0.2's three modes:
 *   - idle: nothing solved yet (omitted entirely)
 *   - empty: target was missing/zero, or no fits and no near-misses
 *   - results: any combination of solutions / bestUnder / bestOver
 */
export function ResultsList({ state, unit }: Props) {
  if (state.kind === "idle") {
    return <section className="results" id="results" />;
  }

  if (state.kind === "empty") {
    // Two flavors share the empty-state look. The first is the v0.2
    // "Enter a target gap length to solve" message; the second is the
    // "nothing in your inventory comes close" message.
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

  const { result, target_mm, elapsed, inventory } = state;

  // Stable color per piece label across this solve.
  const labelColors: Record<string, string> = {};
  inventory.forEach((it) => {
    if (!labelColors[it.label]) {
      const idx = Object.keys(labelColors).length % BAR_COLORS.length;
      labelColors[it.label] = BAR_COLORS[idx] as string;
    }
  });

  if (result.solutions.length > 0) {
    return (
      <section className="results" id="results">
        <p className="label">
          {result.solutions.length} solution
          {result.solutions.length === 1 ? "" : "s"} · solved in {elapsed}ms
        </p>
        {result.solutions.map((sol, i) => (
          <ResultCard
            key={i}
            solution={sol}
            kind="fit"
            unit={unit}
            target_mm={target_mm}
            labelColors={labelColors}
          />
        ))}
      </section>
    );
  }

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
        />
      ) : null}
      {result.bestOver ? (
        <ResultCard
          solution={result.bestOver}
          kind="over"
          unit={unit}
          target_mm={target_mm}
          labelColors={labelColors}
        />
      ) : null}
    </section>
  );
}
