import { parseAnyrail } from "./anyrail.js";
import type { ParsePlanResult } from "./types.js";

export { buildBuyList } from "./buy-list.js";
export type {
  BuyListEntry,
  BuyListInput,
  ParsePlanResult,
  PlanRequirement,
} from "./types.js";

/**
 * Parse a plan file. Today only AnyRail XML is supported; the function name
 * stays format-agnostic so callers don't churn when SCARM / XTrkCAD / JMRI
 * land. Format sniffing is intentionally cheap — we look for the AnyRail
 * root element and dispatch.
 */
export function parsePlan(xmlString: string): ParsePlanResult {
  return parseAnyrail(xmlString);
}
