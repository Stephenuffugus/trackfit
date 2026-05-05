import { SYSTEMS } from "@trackfit/library";
import type { BuyListEntry, BuyListInput } from "./types.js";

/**
 * Subtract what the user already owns from what the plan needs.
 *
 * Match precedence per requirement:
 *   1. inventory rows whose (system_id, product_code) match exactly
 *   2. inventory rows whose label matches the canonical library label exactly
 *   3. nothing — on_hand stays 0
 *
 * The library cross-reference is only used for the display label and the
 * label-fallback match; we never re-derive system_id or product_code from
 * the library, because the source of truth for "what's in this plan" is
 * the plan itself.
 */
export function buildBuyList(input: BuyListInput): BuyListEntry[] {
  const entries: BuyListEntry[] = [];

  for (const req of input.requirements) {
    const label = lookupLabel(req.system_id, req.product_code);

    let onHand = 0;
    let matched = false;

    // 1. exact (system_id, product_code) match.
    for (const row of input.inventory) {
      if (
        row.system_id === req.system_id &&
        row.product_code != null &&
        row.product_code === req.product_code
      ) {
        onHand += row.qty;
        matched = true;
      }
    }

    // 2. label fallback. Only consult if the strict match found nothing —
    //    we don't want to double-count an inventory row that already matched.
    if (!matched && label) {
      for (const row of input.inventory) {
        if (row.label && row.label === label) {
          onHand += row.qty;
        }
      }
    }

    entries.push({
      system_id: req.system_id,
      product_code: req.product_code,
      label,
      required: req.count,
      on_hand: onHand,
      to_buy: Math.max(0, req.count - onHand),
    });
  }

  // Sort: most-needed first, then deterministic by (system, code).
  entries.sort((a, b) => {
    if (b.to_buy !== a.to_buy) return b.to_buy - a.to_buy;
    const sysCmp = a.system_id.localeCompare(b.system_id);
    if (sysCmp !== 0) return sysCmp;
    return a.product_code.localeCompare(b.product_code);
  });

  return entries;
}

function lookupLabel(systemId: string, productCode: string): string {
  const system = SYSTEMS[systemId];
  if (!system) return productCode;
  const piece = system.pieces.find((p) => p.product_code === productCode);
  return piece?.label ?? productCode;
}
