import { describe, expect, it } from "vitest";
import { searchLinks, searchLinksForMissingPiece } from "../src/index.js";

describe("searchLinks", () => {
  it("returns at least eBay + Walthers + Trainz for any non-empty query", () => {
    const links = searchLinks({ query: '10" Lionel FasTrack straight' });
    const vendors = new Set(links.map((l) => l.vendor));
    expect(vendors.has("ebay")).toBe(true);
    expect(vendors.has("walthers")).toBe(true);
    expect(vendors.has("trainz")).toBe(true);
  });

  it("returns empty array for an empty query with no SKU", () => {
    expect(searchLinks({ query: "" })).toHaveLength(0);
  });

  it("still works when only product_code is given", () => {
    const links = searchLinks({ query: "", product_code: "6-12014" });
    expect(links.length).toBeGreaterThan(0);
    // The eBay URL should contain the SKU.
    const ebay = links.find((l) => l.vendor === "ebay");
    expect(ebay?.url).toContain("6-12014");
  });

  it("URL-encodes the query for safety", () => {
    const links = searchLinks({ query: 'O36 curve & 10" straight' });
    const ebay = links.find((l) => l.vendor === "ebay")!;
    // The "&" must be encoded as %26 in the URL parameter.
    expect(ebay.url).toContain("%26");
    // The 10" straight contains a quote — must be encoded.
    expect(ebay.url).toContain("%22");
  });

  it("ranks Hattons higher when locale is UK", () => {
    const us = searchLinks({ query: "Hornby R600 straight" }, { locale: "US" });
    const uk = searchLinks({ query: "Hornby R600 straight" }, { locale: "UK" });
    const usHattonsIdx = us.findIndex((l) => l.vendor === "hattons");
    const ukHattonsIdx = uk.findIndex((l) => l.vendor === "hattons");
    expect(ukHattonsIdx).toBeLessThan(usHattonsIdx);
  });

  it("includes Reynaulds when query mentions Märklin or system_id starts with marklin", () => {
    const linksByText = searchLinks({ query: "Märklin C-Track curve" });
    const linksBySystem = searchLinks({
      query: "C-Track straight",
      system_id: "marklin-c-track",
    });
    expect(linksByText.some((l) => l.vendor === "reynaulds")).toBe(true);
    expect(linksBySystem.some((l) => l.vendor === "reynaulds")).toBe(true);
  });

  it("does NOT include Reynaulds for an unrelated query", () => {
    const links = searchLinks({ query: "Lionel FasTrack 10in straight" });
    expect(links.some((l) => l.vendor === "reynaulds")).toBe(false);
  });

  it("biases eBay up when condition_preference is 'used'", () => {
    const used = searchLinks({
      query: "FasTrack 10in straight",
      condition_preference: "used",
    });
    expect(used[0]!.vendor).toBe("ebay");
  });

  it("demotes Amazon below at least one specialty dealer", () => {
    const links = searchLinks({ query: "Atlas Code 83 9-inch straight" });
    const amazonIdx = links.findIndex((l) => l.vendor === "amazon");
    const walthersIdx = links.findIndex((l) => l.vendor === "walthers");
    expect(walthersIdx).toBeLessThan(amazonIdx);
  });

  it("propagates affiliate_tag from config to MarketplaceLink", () => {
    const links = searchLinks(
      { query: "anything" },
      { affiliate_tags: { ebay: "trackfit-20" } },
    );
    const ebay = links.find((l) => l.vendor === "ebay")!;
    expect(ebay.affiliate_tag).toBe("trackfit-20");
  });
});

describe("searchLinksForMissingPiece", () => {
  it("composes a sensible query for a missing straight piece", () => {
    const links = searchLinksForMissingPiece(
      { kind: "straight", length_mm: 127 }, // 5"
      { manufacturer: "Lionel", id: "lionel-fastrack" },
    );
    const ebay = links.find((l) => l.vendor === "ebay")!;
    // Should contain the manufacturer + the inch value.
    expect(ebay.url).toMatch(/Lionel/i);
    expect(ebay.url).toMatch(/5\.00.{0,12}straight/i); // %22%20 etc encode wider than literal chars
  });

  it("composes a sensible query for a missing curve piece", () => {
    const links = searchLinksForMissingPiece(
      { kind: "curve", radius_mm: 457, arc_degrees: 30 },
      { manufacturer: "Lionel" },
    );
    const ebay = links.find((l) => l.vendor === "ebay")!;
    expect(ebay.url).toContain("457mm");
    // %C2%B0 = "°"; allow up to ~12 encoded chars between "30" and "curve".
    expect(ebay.url).toMatch(/30.{0,12}curve/i);
  });

  it("falls back to label when kind is unknown", () => {
    const links = searchLinksForMissingPiece(
      { label: "Atlas Code 83 #4 turnout" },
      { scale: "HO" },
    );
    expect(links.length).toBeGreaterThan(0);
    const ebay = links.find((l) => l.vendor === "ebay")!;
    expect(ebay.url).toMatch(/Atlas/i);
    expect(ebay.url).toMatch(/turnout/i);
  });

  it("returns empty when missing has no useful fields", () => {
    expect(searchLinksForMissingPiece({}, undefined)).toHaveLength(0);
  });
});
