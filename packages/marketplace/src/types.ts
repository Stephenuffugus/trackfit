/**
 * Marketplace link types. Pure data — no fetching, no UI.
 */

export type Vendor =
  | "ebay"
  | "trainz"
  | "walthers"
  | "tower-hobbies"
  | "modeltrainstuff"
  | "hattons"
  | "reynaulds"
  | "amazon";

export interface MarketplaceLink {
  vendor: Vendor;
  /** human-readable vendor label, e.g. "eBay (search sold listings)" */
  label: string;
  /** ready-to-open URL */
  url: string;
  /** is this likely to find a single specific SKU (true) or a fuzzy match (false) */
  precision: "sku" | "fuzzy";
  /**
   * Why we picked this vendor for this query. Shown to the user in plain
   * English next to the link, e.g. "Best for inherited / used pieces".
   */
  rationale: string;
  /**
   * Free shipping / typical price hint when known. Conservative — falls back
   * to undefined if we can't make a confident statement.
   */
  hint?: string;
  /**
   * Affiliate-tag hook. The link generator passes through any non-empty
   * affiliate config it's given; this field is null until we sign up for
   * each program. Phase 3 commercial path per strategy doc §4.2.
   */
  affiliate_tag?: string;
}

export interface MarketplaceQuery {
  /** what the user is looking for, e.g. '10" Lionel FasTrack straight' or "5mm fitter" */
  query: string;
  /** optional manufacturer SKU like "6-12014" — vendor URLs that support SKU search use this */
  product_code?: string | null;
  /** track scale to disambiguate searches */
  scale?: "Z" | "N" | "TT" | "HO" | "OO" | "S" | "O" | "G";
  /** track system slug if known, e.g. "lionel-fastrack" */
  system_id?: string;
  /** if the user explicitly wants "new" or "used" — affects which vendors to lead with */
  condition_preference?: "any" | "new" | "used";
}

export interface MarketplaceConfig {
  /** affiliate tags by vendor; if absent, links are clean */
  affiliate_tags?: Partial<Record<Vendor, string>>;
  /** locale hint for region-correct vendor ordering */
  locale?: "US" | "UK" | "EU" | "JP";
}
