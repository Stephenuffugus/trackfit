/**
 * Rule-based layout matcher. Buckets the user's inventory by category
 * (straight length, curve sweep, turnouts, crossings), then for every
 * template in the catalog computes a per-axis shortfall and a 0..1
 * match score.
 *
 * Design principles:
 *  - No LLM, no web access — the audience trusts deterministic answers.
 *  - Never hide an "almost-buildable" template; the value is exactly
 *    "you're 4 inches short of a small dogbone — get one more straight".
 *  - The rationale must always be a non-empty plain-English sentence.
 *  - Sort by descending score, returning up to 8 suggestions.
 */
import { LAYOUT_TEMPLATES } from "./catalog.js";
import type {
  LayoutShortfall,
  LayoutSuggestion,
  LayoutTemplate,
  SuggesterInput,
  SuggesterInventoryItem,
} from "./types.js";

/** Maximum number of suggestions returned by `suggestLayouts`. */
// Keep this >= the catalog size so scale-pinned templates never get sliced
// off the end. The UI is responsible for any visual top-N truncation.
const MAX_SUGGESTIONS = 20;

/**
 * Score window inside which the axes-short tiebreaker fires. Two
 * non-buildable suggestions whose match_score differs by no more than
 * this are considered "close enough" that the qualitative
 * single-axis-vs-multi-axis distinction should win out. Picked at 0.05
 * so a meaningfully better numeric score (e.g. 0.9 vs 0.5) still wins.
 */
const AXES_TIEBREAKER_WINDOW = 0.05;

/** Count how many shortfall axes are non-zero (0..4). */
function countAxesShort(shortfall: LayoutShortfall): number {
  let n = 0;
  if (shortfall.straight_length_mm > 0) n++;
  if (shortfall.curve_total_degrees > 0) n++;
  if (shortfall.turnouts > 0) n++;
  if (shortfall.crossings > 0) n++;
  return n;
}

/**
 * Per-axis weights when normalising a shortfall into a 0..1 score.
 * Total weight is 1; an axis whose template requirement is 0 contributes 0.
 * We give length and curve sweep equal billing because most layouts depend
 * on both; turnouts and crossings are lower-weighted because they're
 * cheaper for the user to acquire as a one-off purchase.
 */
const AXIS_WEIGHTS = {
  straight: 0.35,
  curve: 0.35,
  turnout: 0.2,
  crossing: 0.1,
} as const;

/**
 * Rough mm-equivalent we use to express a curve shortfall in plain English.
 * 30° at a typical HO radius (~450 mm) is about 235 mm of arc; we round it
 * down so "you need ~XX° more curve" maps to "about N more 22.5°/30°
 * sections". The matcher itself doesn't depend on this number.
 */
const TYPICAL_CURVE_SECTION_DEGREES = 22.5;

interface InventoryBucket {
  straight_length_mm: number;
  curve_total_degrees: number;
  /** smallest curve radius in inventory, mm. Infinity if no curves. */
  min_curve_radius_mm: number;
  /** largest curve radius in inventory, mm. 0 if no curves. */
  max_curve_radius_mm: number;
  turnouts: number;
  crossings: number;
}

/**
 * Reduce raw inventory to four totals + the radius range of any curves.
 *
 * We treat anything that contributes longitudinal length the same way:
 * straights, fitters, flex (nominal length), rerailers, bumpers, and
 * transitions. Turnouts and crossings are counted by qty only — their
 * length is bookkeeping noise compared to whether the user *has* one.
 */
export function bucketInventory(
  items: SuggesterInventoryItem[],
): InventoryBucket {
  const out: InventoryBucket = {
    straight_length_mm: 0,
    curve_total_degrees: 0,
    min_curve_radius_mm: Infinity,
    max_curve_radius_mm: 0,
    turnouts: 0,
    crossings: 0,
  };
  for (const it of items) {
    if (it.qty <= 0) continue;
    switch (it.kind) {
      case "straight":
      case "fitter":
      case "flex":
      case "rerailer":
      case "bumper":
      case "transition":
      case "uncoupler": {
        if (typeof it.length_mm === "number" && it.length_mm > 0) {
          out.straight_length_mm += it.length_mm * it.qty;
        }
        break;
      }
      case "curve": {
        const arc = typeof it.arc_degrees === "number" ? it.arc_degrees : 0;
        if (arc > 0) out.curve_total_degrees += arc * it.qty;
        const r = typeof it.radius_mm === "number" ? it.radius_mm : 0;
        if (r > 0) {
          if (r < out.min_curve_radius_mm) out.min_curve_radius_mm = r;
          if (r > out.max_curve_radius_mm) out.max_curve_radius_mm = r;
        }
        break;
      }
      case "turnout":
        out.turnouts += it.qty;
        break;
      case "crossing":
        out.crossings += it.qty;
        break;
    }
  }
  return out;
}

/** Compute the per-axis shortfall (always ≥ 0). */
function shortfallOf(
  bucket: InventoryBucket,
  tpl: LayoutTemplate,
): LayoutShortfall {
  const req = tpl.requirements;
  return {
    straight_length_mm: Math.max(0, req.straight_length_mm - bucket.straight_length_mm),
    curve_total_degrees: Math.max(0, req.curve_total_degrees - bucket.curve_total_degrees),
    turnouts: Math.max(0, (req.turnouts ?? 0) - bucket.turnouts),
    crossings: Math.max(0, (req.crossings ?? 0) - bucket.crossings),
  };
}

/**
 * Penalty (0..1) added when the user's curve radii don't match a template's
 * radius window. This is a soft signal: a Christmas-tree loop "wants" tight
 * curves but a bigger radius isn't fatal — it just means the layout might
 * not actually fit the stated footprint.
 */
function radiusPenalty(
  bucket: InventoryBucket,
  tpl: LayoutTemplate,
): number {
  // Templates with no curve requirement skip this entirely.
  if (tpl.requirements.curve_total_degrees === 0) return 0;
  // No curves in inventory → already captured by the curve_total_degrees axis.
  if (bucket.curve_total_degrees === 0) return 0;
  const req = tpl.requirements;
  let penalty = 0;
  if (typeof req.max_curve_radius_mm === "number") {
    // We need *some* curve at or below the maximum; if our smallest radius
    // exceeds it, ding the score.
    if (bucket.min_curve_radius_mm > req.max_curve_radius_mm) {
      const ratio = bucket.min_curve_radius_mm / req.max_curve_radius_mm;
      penalty += Math.min(0.25, (ratio - 1) * 0.25);
    }
  }
  if (typeof req.min_curve_radius_mm === "number") {
    if (bucket.max_curve_radius_mm < req.min_curve_radius_mm && bucket.max_curve_radius_mm > 0) {
      const ratio = req.min_curve_radius_mm / bucket.max_curve_radius_mm;
      penalty += Math.min(0.25, (ratio - 1) * 0.25);
    }
  }
  return penalty;
}

/**
 * Convert a shortfall into a normalised 0..1 score where 1.0 = exact match.
 * Each axis is normalised against its own *requirement* (so being 100% short
 * on length scores 0 on that axis); if the requirement is 0, that axis is
 * skipped and its weight is redistributed across the others.
 */
function scoreFromShortfall(
  shortfall: LayoutShortfall,
  tpl: LayoutTemplate,
): number {
  const req = tpl.requirements;
  const axes: { weight: number; deficit: number }[] = [];
  if (req.straight_length_mm > 0) {
    axes.push({
      weight: AXIS_WEIGHTS.straight,
      deficit: Math.min(1, shortfall.straight_length_mm / req.straight_length_mm),
    });
  }
  if (req.curve_total_degrees > 0) {
    axes.push({
      weight: AXIS_WEIGHTS.curve,
      deficit: Math.min(1, shortfall.curve_total_degrees / req.curve_total_degrees),
    });
  }
  if ((req.turnouts ?? 0) > 0) {
    axes.push({
      weight: AXIS_WEIGHTS.turnout,
      deficit: Math.min(1, shortfall.turnouts / (req.turnouts as number)),
    });
  }
  if ((req.crossings ?? 0) > 0) {
    axes.push({
      weight: AXIS_WEIGHTS.crossing,
      deficit: Math.min(1, shortfall.crossings / (req.crossings as number)),
    });
  }
  if (axes.length === 0) return 1;
  // Renormalise so weights sum to 1 across the *active* axes.
  const totalWeight = axes.reduce((a, b) => a + b.weight, 0);
  const weightedDeficit = axes.reduce(
    (acc, a) => acc + (a.weight / totalWeight) * a.deficit,
    0,
  );
  return Math.max(0, 1 - weightedDeficit);
}

/**
 * Generate a 1-2 sentence rationale. We deliberately keep the sentence
 * templates small and concrete: older audiences hate vague output.
 */
function buildRationale(
  bucket: InventoryBucket,
  tpl: LayoutTemplate,
  shortfall: LayoutShortfall,
  buildable: boolean,
): string {
  if (buildable) {
    const parts: string[] = [];
    if (tpl.requirements.straight_length_mm > 0) {
      const have = bucket.straight_length_mm;
      const need = tpl.requirements.straight_length_mm;
      if (have >= need * 1.1) parts.push("plenty of straight track");
      else parts.push("just enough straight track");
    }
    if (tpl.requirements.curve_total_degrees > 0) {
      const have = bucket.curve_total_degrees;
      const need = tpl.requirements.curve_total_degrees;
      if (have >= need * 1.1) parts.push("more than enough curve");
      else parts.push(`just enough curve for the ${need}° loop`);
    }
    const turnoutsReq = tpl.requirements.turnouts ?? 0;
    if (turnoutsReq > 0) {
      parts.push(`the ${turnoutsReq} turnout${turnoutsReq === 1 ? "" : "s"} this layout needs`);
    }
    if (parts.length === 0) {
      return `You have everything you need to build the ${tpl.name.toLowerCase()}.`;
    }
    return `You have ${joinWithAnd(parts)} — you can build the ${tpl.name.toLowerCase()} today.`;
  }

  // Not buildable — call out the single biggest miss in plain English.
  const misses: string[] = [];
  if (shortfall.straight_length_mm > 0) {
    const mm = Math.round(shortfall.straight_length_mm);
    misses.push(`about ${mm} mm more straight track`);
  }
  if (shortfall.curve_total_degrees > 0) {
    const deg = Math.round(shortfall.curve_total_degrees);
    const sections = Math.max(
      1,
      Math.ceil(deg / TYPICAL_CURVE_SECTION_DEGREES),
    );
    misses.push(
      `${deg}° more curve (about ${sections} more curve section${sections === 1 ? "" : "s"})`,
    );
  }
  if (shortfall.turnouts > 0) {
    misses.push(`${shortfall.turnouts} more turnout${shortfall.turnouts === 1 ? "" : "s"}`);
  }
  if (shortfall.crossings > 0) {
    misses.push(`${shortfall.crossings} more crossing${shortfall.crossings === 1 ? "" : "s"}`);
  }
  if (misses.length === 0) {
    // Defensive fallback — shouldn't happen if buildable was computed correctly.
    return `You're close on the ${tpl.name.toLowerCase()}, but the inventory doesn't quite line up.`;
  }
  return `You're close on the ${tpl.name.toLowerCase()} — pick up ${joinWithAnd(misses)} and you'll have it.`;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/**
 * Score every template against the user's inventory and return the top
 * matches.
 *
 * @param input  inventory + optional scale and footprint hint
 * @returns up to 8 suggestions, sorted best-first
 */
export function suggestLayouts(input: SuggesterInput): LayoutSuggestion[] {
  const bucket = bucketInventory(input.inventory);
  const out: LayoutSuggestion[] = [];

  for (const tpl of LAYOUT_TEMPLATES) {
    // Scale filter: drop templates that pin a specific scale list when the
    // user told us their scale and it's not on the list.
    if (input.scale && tpl.scales && !tpl.scales.includes(input.scale)) {
      continue;
    }

    const shortfall = shortfallOf(bucket, tpl);
    const buildable =
      shortfall.straight_length_mm === 0 &&
      shortfall.curve_total_degrees === 0 &&
      shortfall.turnouts === 0 &&
      shortfall.crossings === 0;

    let score = scoreFromShortfall(shortfall, tpl);

    // Soft penalty for radius mismatch (only when we have curves to compare).
    score = Math.max(0, score - radiusPenalty(bucket, tpl));

    // Compact-footprint preference: nudge templates whose footprint is below
    // ~1500mm wide a touch up the rankings. Capped so it never reorders a
    // clearly-better match.
    if (input.prefer_compact) {
      if (tpl.footprint.width_mm <= 1500) score = Math.min(1, score + 0.05);
    }

    const rationale = buildRationale(bucket, tpl, shortfall, buildable);

    out.push({
      template: tpl,
      match_score: score,
      shortfall,
      buildable,
      rationale,
      axes_short: buildable ? 0 : countAxesShort(shortfall),
    });
  }

  out.sort(compareSuggestions);
  return out.slice(0, MAX_SUGGESTIONS);
}

/**
 * Comparator for two suggestions. Exported for the unit tests to
 * exercise the rules directly without needing to engineer real
 * inventories that produce specific score and axes-short combinations.
 *
 * Sort rules, in order:
 *  1. Buildable layouts always rank first.
 *  2. Within the not-yet-buildable cluster, when two scores are within
 *     `AXES_TIEBREAKER_WINDOW` of each other, the one short on fewer
 *     axes wins. This codifies the qualitative "one shopping trip away"
 *     vs "missing things across the board" distinction.
 *  3. Otherwise, higher score wins.
 *  4. Final tiebreaker: ambition (more turnouts, crossings, curve, then
 *     length).
 */
export function compareSuggestions(
  a: LayoutSuggestion,
  b: LayoutSuggestion,
): number {
  if (a.buildable !== b.buildable) return a.buildable ? -1 : 1;

  if (!a.buildable && !b.buildable) {
    const scoreGap = Math.abs(a.match_score - b.match_score);
    if (scoreGap <= AXES_TIEBREAKER_WINDOW) {
      const aAxes = a.axes_short ?? countAxesShort(a.shortfall);
      const bAxes = b.axes_short ?? countAxesShort(b.shortfall);
      if (aAxes !== bAxes) return aAxes - bAxes;
    }
  }

  if (Math.abs(a.match_score - b.match_score) > 1e-6) {
    return b.match_score - a.match_score;
  }

  const ambitionScore = (s: LayoutSuggestion) => {
    const req = s.template.requirements;
    return (
      (req.turnouts ?? 0) * 1000 +
      (req.crossings ?? 0) * 500 +
      req.curve_total_degrees * 0.5 +
      req.straight_length_mm * 0.001
    );
  };
  return ambitionScore(b) - ambitionScore(a);
}
