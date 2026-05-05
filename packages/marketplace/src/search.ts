import type {
  MarketplaceConfig,
  MarketplaceLink,
  MarketplaceQuery,
  Vendor,
} from "./types.js";

/**
 * Generates marketplace search links for a missing or wanted track piece.
 *
 * Returns a ranked list (best-first) of vendor URLs. Order depends on:
 *   - locale (US-first vs UK-first)
 *   - condition_preference (new biases dealers; used biases eBay)
 *   - scale (some vendors specialise; e.g. Reynaulds for European)
 *
 * No network calls happen here. The strings are URL-encoded and ready to
 * `window.open()` from the UI.
 */
export function searchLinks(
  query: MarketplaceQuery,
  config: MarketplaceConfig = {},
): MarketplaceLink[] {
  const links: MarketplaceLink[] = [];
  const locale = config.locale ?? "US";

  const sku = query.product_code?.trim();
  const text = query.query.trim();

  if (!text && !sku) return [];

  const effectiveQuery = sku ? `${text} ${sku}`.trim() : text;
  const enc = encodeURIComponent(effectiveQuery);

  // eBay — always include, both new and used. Best for inherited / discontinued pieces.
  links.push({
    vendor: "ebay",
    label: "eBay",
    url:
      `https://www.ebay.com/sch/i.html?_nkw=${enc}` +
      // Bias towards "model train track" category to filter false positives.
      `&_sacat=0&LH_TitleDesc=1`,
    precision: sku ? "sku" : "fuzzy",
    rationale: "Best for used and discontinued pieces; widest selection.",
    affiliate_tag: config.affiliate_tags?.ebay,
  });

  // Trainz.com — strong US sectional/secondhand.
  links.push({
    vendor: "trainz",
    label: "Trainz.com",
    url: `https://www.trainz.com/search?q=${enc}`,
    precision: "fuzzy",
    rationale: "Specialty model-railroad shop; good for both new and used.",
    affiliate_tag: config.affiliate_tags?.trainz,
  });

  // Walthers — major distributor, US.
  links.push({
    vendor: "walthers",
    label: "Walthers",
    url: `https://www.walthers.com/search?q=${enc}`,
    precision: "fuzzy",
    rationale:
      "Largest US model-railroad catalog; usually stocks everything in production.",
    affiliate_tag: config.affiliate_tags?.walthers,
  });

  // ModelTrainStuff
  links.push({
    vendor: "modeltrainstuff",
    label: "ModelTrainStuff",
    url: `https://www.modeltrainstuff.com/search?q=${enc}`,
    precision: "fuzzy",
    rationale: "Reliable US dealer; often-discounted pricing.",
    affiliate_tag: config.affiliate_tags?.modeltrainstuff,
  });

  // Tower Hobbies
  links.push({
    vendor: "tower-hobbies",
    label: "Tower Hobbies",
    url: `https://www.towerhobbies.com/search/?text=${enc}`,
    precision: "fuzzy",
    rationale: "Generalist hobby retailer; sometimes carries hard-to-find SKUs.",
    affiliate_tag: config.affiliate_tags?.["tower-hobbies"],
  });

  // Hattons (UK), Reynaulds (Märklin)
  links.push({
    vendor: "hattons",
    label: "Hattons",
    url: `https://www.hattons.co.uk/searchresults.aspx?q=${enc}`,
    precision: "fuzzy",
    rationale: "UK specialist — best for Hornby, Peco, Bachmann Branchline.",
    affiliate_tag: config.affiliate_tags?.hattons,
  });

  if (
    query.system_id?.startsWith("marklin") ||
    /m[äa]rklin/i.test(text)
  ) {
    links.push({
      vendor: "reynaulds",
      label: "Reynaulds Euro Imports",
      url: `https://www.reynaulds.com/search.aspx?q=${enc}`,
      precision: "fuzzy",
      rationale: "US Märklin specialist; best source for C-Track and K-Track.",
      affiliate_tag: config.affiliate_tags?.reynaulds,
    });
  }

  // Amazon last — usually overpriced for niche track pieces but sometimes ships fast.
  links.push({
    vendor: "amazon",
    label: "Amazon",
    url: `https://www.amazon.com/s?k=${enc}`,
    precision: "fuzzy",
    rationale: "Convenience option; selection is patchy and prices vary.",
    affiliate_tag: config.affiliate_tags?.amazon,
  });

  return rank(links, query, locale);
}

function rank(
  links: MarketplaceLink[],
  query: MarketplaceQuery,
  locale: "US" | "UK" | "EU" | "JP",
): MarketplaceLink[] {
  const score = (link: MarketplaceLink): number => {
    let s = 0;
    // Used preference favours eBay.
    if (query.condition_preference === "used" && link.vendor === "ebay") s += 10;
    if (query.condition_preference === "new" && link.vendor === "ebay") s -= 4;
    // SKU precision bumps the vendor that handles SKU search well.
    if (link.precision === "sku") s += 5;
    // Locale bias.
    if (locale === "UK" && link.vendor === "hattons") s += 8;
    if (locale === "EU" && link.vendor === "reynaulds") s += 6;
    if (locale === "US" && link.vendor === "walthers") s += 3;
    // Demote Amazon by default; it's a fallback.
    if (link.vendor === "amazon") s -= 6;
    return s;
  };
  return [...links].sort((a, b) => score(b) - score(a));
}

/**
 * Convenience for when the solver returns a missing-piece suggestion. Pulls
 * the relevant fields off and constructs a clean query.
 */
export function searchLinksForMissingPiece(
  missing: {
    label?: string;
    length_mm?: number;
    radius_mm?: number;
    arc_degrees?: number;
    kind?: string;
  },
  systemHint?: { id?: string; manufacturer?: string; scale?: MarketplaceQuery["scale"] },
  config?: MarketplaceConfig,
): MarketplaceLink[] {
  const parts: string[] = [];
  if (systemHint?.manufacturer) parts.push(systemHint.manufacturer);
  if (missing.kind === "curve") {
    if (missing.radius_mm) parts.push(`${Math.round(missing.radius_mm)}mm radius`);
    if (missing.arc_degrees) parts.push(`${missing.arc_degrees}° curve`);
  } else if (missing.kind === "straight" && missing.length_mm) {
    const inches = (missing.length_mm / 25.4).toFixed(2);
    parts.push(`${inches}" straight`);
  } else if (missing.label) {
    parts.push(missing.label);
  }

  const query: MarketplaceQuery = {
    query: parts.join(" "),
    scale: systemHint?.scale,
    system_id: systemHint?.id,
  };
  return searchLinks(query, config);
}
