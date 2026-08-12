import { describe, expect, it } from "vitest";
import { CATEGORY_SEARCH_DEFAULTS, categorySearchSchema } from "./category-search-params";

// Regresi: filter kategori HARUS bertahan lewat query string agar URL bisa
// dibagikan / dibuka ulang. Bug yang dijaga: min/max harga bertipe number
// supaya `?min=500000` tetap number (URL bersih tanpa kutip) dan tidak gagal
// validasi lalu ter-strip; q di-coerce agar pencarian numerik tak hilang.

describe("categorySearchSchema — filter bertahan lewat query string", () => {
  it("min/max harga adalah number (URL bersih, tidak ter-strip)", () => {
    const r = categorySearchSchema.parse({ min: 500000, max: 1000000 });
    expect(r.min).toBe(500000);
    expect(r.max).toBe(1000000);
  });

  it("min negatif jatuh ke 0 (tanpa filter), bukan melempar", () => {
    expect(categorySearchSchema.parse({ min: -5 }).min).toBe(0);
  });

  it("pencarian numerik tetap bertahan sebagai string", () => {
    expect(categorySearchSchema.parse({ q: 123 }).q).toBe("123");
  });

  it("pencarian teks biasa apa adanya", () => {
    expect(categorySearchSchema.parse({ q: "sneaker" }).q).toBe("sneaker");
  });

  it("rating tetap number; page tetap number", () => {
    const r = categorySearchSchema.parse({ rating: 4.5, page: 2 });
    expect(r.rating).toBe(4.5);
    expect(r.page).toBe(2);
  });

  it("tanpa param → semua default (yang memang di-strip dari URL)", () => {
    expect(categorySearchSchema.parse({})).toEqual(CATEGORY_SEARCH_DEFAULTS);
  });

  it("nilai invalid jatuh ke fallback, bukan melempar", () => {
    expect(categorySearchSchema.parse({ rating: "abc" }).rating).toBe(0);
    expect(categorySearchSchema.parse({ page: -5 }).page).toBe(1);
    expect(categorySearchSchema.parse({ sort: 42 }).sort).toBe("popular");
  });

  it("URL terfilter lengkap round-trip utuh", () => {
    const parsed = categorySearchSchema.parse({
      q: "lari",
      min: 250000,
      max: 750000,
      rating: 4,
      sort: "price-low",
      page: 2,
    });
    expect(parsed).toEqual({
      q: "lari",
      min: 250000,
      max: 750000,
      rating: 4,
      sort: "price-low",
      page: 2,
    });
  });
});
