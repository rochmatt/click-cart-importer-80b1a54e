import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import {
  cocokFilterFeed,
  feedFilterAktif,
  FEED_FILTER_KOSONG,
  hargaProduk,
  ringkasanFilterFeed,
  urutkanFeed,
} from "./discover-feed-filter";

const buat = (over: Partial<Product>): Product =>
  ({ category: "Fashion", rating: 4.5, price: "Rp 500.000", ...over }) as Product;

describe("hargaProduk — parse string rupiah", () => {
  it("mengambil angka saja", () => {
    expect(hargaProduk("Rp 549.000")).toBe(549000);
    expect(hargaProduk("")).toBe(0);
  });
});

describe("cocokFilterFeed", () => {
  it("filter kosong meloloskan semua", () => {
    expect(cocokFilterFeed(buat({}), FEED_FILTER_KOSONG)).toBe(true);
  });

  it("kategori harus persis cocok", () => {
    const p = buat({ category: "Electronics" });
    expect(cocokFilterFeed(p, { ...FEED_FILTER_KOSONG, category: "Electronics" })).toBe(true);
    expect(cocokFilterFeed(p, { ...FEED_FILTER_KOSONG, category: "Fashion" })).toBe(false);
  });

  it("rating minimum inklusif", () => {
    const p = buat({ rating: 4 });
    expect(cocokFilterFeed(p, { ...FEED_FILTER_KOSONG, minRating: 4 })).toBe(true);
    expect(cocokFilterFeed(p, { ...FEED_FILTER_KOSONG, minRating: 4.5 })).toBe(false);
  });

  it("rentang harga min & max", () => {
    const p = buat({ price: "Rp 500.000" });
    expect(cocokFilterFeed(p, { ...FEED_FILTER_KOSONG, minPrice: 400000, maxPrice: 600000 })).toBe(
      true,
    );
    expect(cocokFilterFeed(p, { ...FEED_FILTER_KOSONG, minPrice: 600000 })).toBe(false);
    expect(cocokFilterFeed(p, { ...FEED_FILTER_KOSONG, maxPrice: 400000 })).toBe(false);
  });

  it("gabungan: gagal satu → gugur", () => {
    const p = buat({ category: "Fashion", rating: 4.8, price: "Rp 300.000" });
    expect(
      cocokFilterFeed(p, { category: "Fashion", minRating: 4, minPrice: 0, maxPrice: 250000 }),
    ).toBe(false); // harga di atas max
  });
});

describe("feedFilterAktif", () => {
  it("kosong = tidak aktif", () => {
    expect(feedFilterAktif(FEED_FILTER_KOSONG)).toBe(false);
  });
  it("salah satu terisi = aktif", () => {
    expect(feedFilterAktif({ ...FEED_FILTER_KOSONG, minRating: 4 })).toBe(true);
    expect(feedFilterAktif({ ...FEED_FILTER_KOSONG, category: "Fashion" })).toBe(true);
  });
});

describe("urutkanFeed", () => {
  const list = [
    buat({ title: "B", price: "Rp 500.000" }),
    buat({ title: "A", price: "Rp 100.000" }),
    buat({ title: "C", price: "Rp 999.000" }),
  ];

  it("relevance mempertahankan urutan", () => {
    expect(urutkanFeed(list, "relevance").map((p) => p.title)).toEqual(["B", "A", "C"]);
  });

  it("price_asc = termurah dulu", () => {
    expect(urutkanFeed(list, "price_asc").map((p) => p.title)).toEqual(["A", "B", "C"]);
  });

  it("price_desc = termahal dulu", () => {
    expect(urutkanFeed(list, "price_desc").map((p) => p.title)).toEqual(["C", "B", "A"]);
  });

  it("tidak memutasi input", () => {
    const asli = list.map((p) => p.title);
    urutkanFeed(list, "price_asc");
    expect(list.map((p) => p.title)).toEqual(asli);
  });
});

describe("ringkasanFilterFeed — narasi screen reader", () => {
  it("tanpa filter", () => {
    expect(ringkasanFilterFeed(FEED_FILTER_KOSONG, 40)).toBe(
      "Tidak ada filter aktif. Menampilkan 40 produk.",
    );
  });

  it("gabungan kategori + rating + harga", () => {
    expect(
      ringkasanFilterFeed(
        { category: "Fashion", minRating: 4, minPrice: 250000, maxPrice: 750000 },
        3,
      ),
    ).toBe(
      "Filter aktif: kategori Fashion, rating 4 bintang ke atas, harga Rp250.000 hingga Rp750.000. Menampilkan 3 produk.",
    );
  });
});
