export { findCombinations } from "./subset-sum.js";
export type {
  InventoryItem,
  Solution,
  SolutionPiece,
  SolverResult,
} from "./types.js";

export { findCurveCombinations, wrapDegrees } from "./curve.js";
export type {
  CurveInventoryItem,
  CurveTarget,
  CurveTolerance,
  CurveSolution,
  CurveSolutionStep,
  CurveSolverResult,
  CurveSolverOptions,
  CurveMissingPiece,
  Pose,
} from "./curve.js";

export const IN_TO_MM = 25.4;

export { findLoops, tracePlan, railMaterial, crossingAngle, leftoverPieces } from "./loops.js";
export type {
  LoopPiece,
  LoopUse,
  LoopPlan,
  LoopOptions,
  LoopResult,
  LoopShape,
  TracedSegment,
} from "./loops.js";
