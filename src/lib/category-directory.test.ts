import { describe, expect, it } from "vitest";
import { dalamRentangJumlah, urutkanKategori } from "./category-directory";

describe("dalamRentangJumlah — bucket jumlah produk", () => {
  it("'all' selalu lolos", () => {
    expect(dalamRentangJumlah(0, "all")).toBe(true);
    expect(dalamRentangJumlah(999, "all")).toBe(true);
  });

  it("0-50 inklusif di 0 dan 50", () => {
    expect(dalamRentangJumlah(0, "0-50")).toBe(true);
    expect(dalamRentangJumlah(50, "0-50")).toBe(true);
    expect(dalamRentangJumlah(51, "0-50")).toBe(false);
  });

  it("51-200 inklusif di batas", () => {
    expect(dalamRentangJumlah(50, "51-200")).toBe(false);
    expect(dalamRentangJumlah(51, "51-200")).toBe(true);
    expect(dalamRentangJumlah(200, "51-200")).toBe(true);
    expect(dalamRentangJumlah(201, "51-200")).toBe(false);
  });

  it("200+ hanya di atas 200", () => {
    expect(dalamRentangJumlah(200, "200+")).toBe(false);
    expect(dalamRentangJumlah(201, "200+")).toBe(true);
  });
});

describe("urutkanKategori", () => {
  const data = [
    { label: "Beauty", count: 1 },
    { label: "Fashion", count: 3 },
    { label: "Electronics", count: 2 },
  ];

  it("popular = jumlah terbanyak dulu", () => {
    expect(urutkanKategori(data, "popular").map((c) => c.label)).toEqual([
      "Fashion",
      "Electronics",
      "Beauty",
    ]);
  });

  it("az = alfabet menaik", () => {
    expect(urutkanKategori(data, "az").map((c) => c.label)).toEqual([
      "Beauty",
      "Electronics",
      "Fashion",
    ]);
  });

  it("za = alfabet menurun", () => {
    expect(urutkanKategori(data, "za").map((c) => c.label)).toEqual([
      "Fashion",
      "Electronics",
      "Beauty",
    ]);
  });

  it("popular memecah seri secara alfabet (stabil)", () => {
    const seri = [
      { label: "Zeta", count: 2 },
      { label: "Alpha", count: 2 },
    ];
    expect(urutkanKategori(seri, "popular").map((c) => c.label)).toEqual(["Alpha", "Zeta"]);
  });

  it("tidak memutasi input", () => {
    const asli = [...data];
    urutkanKategori(data, "az");
    expect(data).toEqual(asli);
  });
});
