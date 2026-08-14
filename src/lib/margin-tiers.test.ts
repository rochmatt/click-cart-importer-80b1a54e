// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  marginForModal,
  suggestPriceFromModal,
  sortTiers,
  hasConfiguredMargins,
  tierLabel,
  tiersWithBounds,
  type MarginTier,
} from "./margin-tiers";

const T: MarginTier[] = [
  { id: "a", maxModal: 50000, marginRp: 15000 },
  { id: "b", maxModal: 100000, marginRp: 25000 },
  { id: "c", maxModal: null, marginRp: 100000 },
];

describe("marginForModal", () => {
  it("modal di bawah batas tingkat pertama", () => {
    expect(marginForModal(30000, T)).toBe(15000);
  });
  it("batas atas bersifat eksklusif (50000 masuk tingkat berikutnya)", () => {
    expect(marginForModal(49999, T)).toBe(15000);
    expect(marginForModal(50000, T)).toBe(25000);
    expect(marginForModal(99999, T)).toBe(25000);
  });
  it("modal >= batas terakhir → tingkat catch-all (null)", () => {
    expect(marginForModal(100000, T)).toBe(100000);
    expect(marginForModal(5_000_000, T)).toBe(100000);
  });
  it("tanpa tingkat → margin 0", () => {
    expect(marginForModal(123456, [])).toBe(0);
  });
});

describe("suggestPriceFromModal", () => {
  it("harga jual = modal + margin tingkatnya", () => {
    expect(suggestPriceFromModal(30000, T)).toBe(45000);
    expect(suggestPriceFromModal(50000, T)).toBe(75000);
    expect(suggestPriceFromModal(250000, T)).toBe(350000);
  });
  it("modal tak valid → null", () => {
    expect(suggestPriceFromModal(null, T)).toBeNull();
    expect(suggestPriceFromModal(undefined, T)).toBeNull();
    expect(suggestPriceFromModal(-5, T)).toBeNull();
  });
});

describe("sortTiers", () => {
  it("urut menaik, null terakhir", () => {
    const acak: MarginTier[] = [
      { id: "c", maxModal: null, marginRp: 1 },
      { id: "b", maxModal: 100000, marginRp: 1 },
      { id: "a", maxModal: 50000, marginRp: 1 },
    ];
    expect(sortTiers(acak).map((t) => t.maxModal)).toEqual([50000, 100000, null]);
  });
});

describe("hasConfiguredMargins", () => {
  it("true bila ada margin > 0", () => {
    expect(hasConfiguredMargins(T)).toBe(true);
  });
  it("false bila semua 0 (default belum diisi)", () => {
    expect(
      hasConfiguredMargins([
        { id: "x", maxModal: 50000, marginRp: 0 },
        { id: "y", maxModal: null, marginRp: 0 },
      ]),
    ).toBe(false);
  });
});

describe("label & bounds", () => {
  it("tierLabel: pertama, tengah, catch-all", () => {
    expect(tierLabel(T[0], 0)).toBe("< Rp50.000");
    expect(tierLabel(T[1], 50000)).toBe("Rp50.000–Rp100.000");
    expect(tierLabel(T[2], 100000)).toBe("≥ Rp100.000");
  });
  it("tiersWithBounds menghitung batas bawah tiap tingkat", () => {
    expect(tiersWithBounds(T).map((r) => r.lower)).toEqual([0, 50000, 100000]);
  });
});
