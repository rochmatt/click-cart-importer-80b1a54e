import { describe, it, expect } from "vitest";
import { parsePriceValue, normalizePrices } from "./price-normalize";
describe("price", () => {
  it("parses", () => {
    expect(parsePriceValue("Rp1.250.000")).toBe(1250000);
    expect(parsePriceValue("1,250,000")).toBe(1250000);
    expect(parsePriceValue("1.250.000,50")).toBe(1250001);
    expect(parsePriceValue("Rp10.000 - Rp25.000")).toBe(10000);
    expect(parsePriceValue("150rb")).toBe(150000);
    expect(parsePriceValue("1,2jt")).toBe(1200000);
    expect(parsePriceValue("99000")).toBe(99000);
    expect(parsePriceValue("gratis")).toBe(null);
  });
  it("normalizes pair", () => {
    expect(normalizePrices(100000, 250000).price).toBe(250000);
    expect(normalizePrices(100000, 100000).salePrice).toBe(null);
    expect(normalizePrices(200000, 150000).discountPercent).toBe(25);
    expect(normalizePrices(50, null).price).toBe(null);
  });
});
