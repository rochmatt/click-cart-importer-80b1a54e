// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseMarketplaceUrl, isShortLink } from "./marketplace-url";

describe("parseMarketplaceUrl — Shopee", () => {
  it("format slug -i.{shop}.{item} + buang query junk", () => {
    expect(
      parseMarketplaceUrl(
        "https://shopee.co.id/Sepatu-Lari-i.5696604.15949131744?sp_atk=abc&xptdk=z",
      ),
    ).toEqual({
      marketplace: "shopee",
      shopId: "5696604",
      itemId: "15949131744",
      domain: "shopee.co.id",
    });
  });

  it("format /product/{shop}/{item}", () => {
    expect(parseMarketplaceUrl("https://shopee.co.id/product/5696604/15949131744")).toEqual({
      marketplace: "shopee",
      shopId: "5696604",
      itemId: "15949131744",
      domain: "shopee.co.id",
    });
  });

  it("pertahankan TLD region (shopee.sg)", () => {
    const p = parseMarketplaceUrl("https://shopee.sg/Thing-i.111.222");
    expect(p).toMatchObject({
      marketplace: "shopee",
      shopId: "111",
      itemId: "222",
      domain: "shopee.sg",
    });
  });

  it("short-link shope.ee → null + terdeteksi short", () => {
    expect(parseMarketplaceUrl("https://shope.ee/9zAbcDefGh")).toBeNull();
    expect(isShortLink("https://shope.ee/9zAbcDefGh")).toBe(true);
  });
});

describe("parseMarketplaceUrl — Tokopedia", () => {
  it("format {shop}/{slug}", () => {
    expect(parseMarketplaceUrl("https://www.tokopedia.com/mossdoom/paperbag-for-gift")).toEqual({
      marketplace: "tokopedia",
      shopDomain: "mossdoom",
      slug: "paperbag-for-gift",
    });
  });

  it("path sistem (search/login) → null", () => {
    expect(parseMarketplaceUrl("https://www.tokopedia.com/search?q=sepatu")).toBeNull();
    expect(parseMarketplaceUrl("https://www.tokopedia.com/login")).toBeNull();
  });

  it("short-link vt.tokopedia → null + short", () => {
    expect(parseMarketplaceUrl("https://vt.tokopedia.com/t/ZS96QwFdqMMKx/")).toBeNull();
    expect(isShortLink("https://vt.tokopedia.com/t/ZS96QwFdqMMKx/")).toBe(true);
  });
});

describe("parseMarketplaceUrl — TikTok", () => {
  it("format /view/product/{id} dan /pdp/.../{id}", () => {
    expect(parseMarketplaceUrl("https://www.tiktok.com/view/product/1729587769570529799")).toEqual({
      marketplace: "tiktok",
      productId: "1729587769570529799",
    });
    expect(
      parseMarketplaceUrl("https://shop.tiktok.com/sg/pdp/x/1729587769570529799"),
    ).toMatchObject({
      marketplace: "tiktok",
      productId: "1729587769570529799",
    });
  });

  it("short-link vt.tiktok → null + short", () => {
    expect(parseMarketplaceUrl("https://vt.tiktok.com/ZSABC123d/")).toBeNull();
    expect(isShortLink("https://vt.tiktok.com/ZSABC123d/")).toBe(true);
  });
});

describe("parseMarketplaceUrl — bukan produk", () => {
  it("link placeholder domain telanjang (data demo) → null", () => {
    expect(parseMarketplaceUrl("https://shopee.co.id")).toBeNull();
    expect(parseMarketplaceUrl("https://www.tokopedia.com")).toBeNull();
    expect(parseMarketplaceUrl("https://www.tiktok.com/shop")).toBeNull();
  });

  it("URL kosong / non-marketplace → null", () => {
    expect(parseMarketplaceUrl("")).toBeNull();
    expect(parseMarketplaceUrl("https://example.com/product/1/2")).toBeNull();
  });
});
