import { describe, expect, it } from "vitest";
import {
  CATEGORY_PAGE_SIZE,
  hitungHalaman,
  jendelaHalaman,
  metaPaginationKategori,
  urlHalamanKategori,
} from "./category-pagination";

// Metadata SEO pagination kategori. Yang dikunci: tiap halaman punya SATU URL
// kanonik yang menunjuk dirinya sendiri, halaman 1 TANPA ?page (agar tak jadi
// duplikat URL telanjang), dan prev/next hanya muncul saat tetangganya ada.

describe("hitungHalaman — penjepitan & slice", () => {
  it("kategori kosong tetap 1 halaman", () => {
    const h = hitungHalaman(0, 1);
    expect(h).toEqual({ page: 1, totalPages: 1, start: 0, end: CATEGORY_PAGE_SIZE });
  });

  it("menghitung total halaman dari jumlah item", () => {
    expect(hitungHalaman(50, 1, 24).totalPages).toBe(3); // ceil(50/24)
    expect(hitungHalaman(24, 1, 24).totalPages).toBe(1);
    expect(hitungHalaman(25, 1, 24).totalPages).toBe(2);
  });

  it("slice sesuai halaman", () => {
    const h = hitungHalaman(50, 2, 24);
    expect(h.start).toBe(24);
    expect(h.end).toBe(48);
  });

  it("menjepit halaman di atas rentang ke halaman terakhir", () => {
    expect(hitungHalaman(50, 999, 24).page).toBe(3);
  });

  it("menjepit halaman < 1 (dan NaN/float) ke 1", () => {
    expect(hitungHalaman(50, 0, 24).page).toBe(1);
    expect(hitungHalaman(50, -5, 24).page).toBe(1);
    expect(hitungHalaman(50, 1.9, 24).page).toBe(1);
    expect(hitungHalaman(50, Number.NaN, 24).page).toBe(1);
  });
});

describe("urlHalamanKategori — halaman 1 tanpa ?page", () => {
  it("halaman 1 = URL telanjang (anti-duplikasi)", () => {
    expect(urlHalamanKategori("https://x.id", "fashion", 1)).toBe("https://x.id/category/fashion");
  });

  it("halaman > 1 memakai ?page=N", () => {
    expect(urlHalamanKategori("https://x.id", "fashion", 3)).toBe(
      "https://x.id/category/fashion?page=3",
    );
  });

  it("origin kosong menghasilkan URL relatif", () => {
    expect(urlHalamanKategori("", "fashion", 2)).toBe("/category/fashion?page=2");
  });
});

describe("metaPaginationKategori — canonical + prev/next", () => {
  const O = "https://inipilihanku.com";
  const rel = (m: ReturnType<typeof metaPaginationKategori>, r: string) =>
    m.links.find((l) => l.rel === r)?.href;

  it("satu halaman: hanya canonical (telanjang), tanpa prev/next & tanpa label", () => {
    const m = metaPaginationKategori(O, "fashion", 1, 1);
    expect(m.links).toEqual([{ rel: "canonical", href: `${O}/category/fashion` }]);
    expect(m.labelJudul).toBe("");
    expect(m.labelDeskripsi).toBe("");
  });

  it("halaman pertama dari banyak: canonical telanjang + next, TANPA prev", () => {
    const m = metaPaginationKategori(O, "fashion", 1, 3);
    expect(rel(m, "canonical")).toBe(`${O}/category/fashion`);
    expect(rel(m, "prev")).toBeUndefined();
    expect(rel(m, "next")).toBe(`${O}/category/fashion?page=2`);
  });

  it("halaman tengah: canonical diri + prev + next; prev ke hal.2 menunjuk telanjang", () => {
    const m = metaPaginationKategori(O, "fashion", 2, 3);
    expect(rel(m, "canonical")).toBe(`${O}/category/fashion?page=2`);
    // prev dari halaman 2 = halaman 1 = URL telanjang, BUKAN ?page=1
    expect(rel(m, "prev")).toBe(`${O}/category/fashion`);
    expect(rel(m, "next")).toBe(`${O}/category/fashion?page=3`);
    expect(m.labelJudul).toBe(" — Halaman 2 dari 3");
    expect(m.labelDeskripsi).toBe(" Halaman 2 dari 3.");
  });

  it("halaman terakhir: canonical diri + prev, TANPA next", () => {
    const m = metaPaginationKategori(O, "fashion", 3, 3);
    expect(rel(m, "canonical")).toBe(`${O}/category/fashion?page=3`);
    expect(rel(m, "prev")).toBe(`${O}/category/fashion?page=2`);
    expect(rel(m, "next")).toBeUndefined();
  });

  it("hanya ada satu canonical, selalu", () => {
    for (let p = 1; p <= 5; p++) {
      const canon = metaPaginationKategori(O, "beauty", p, 5).links.filter(
        (l) => l.rel === "canonical",
      );
      expect(canon).toHaveLength(1);
    }
  });
});

describe("jendelaHalaman — deret nomor halaman", () => {
  it("≤ 7 halaman: tampil penuh", () => {
    expect(jendelaHalaman(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(jendelaHalaman(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("banyak halaman: dijendela dengan elipsis", () => {
    expect(jendelaHalaman(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
  });

  it("dekat awal / akhir tidak menaruh elipsis berlebih", () => {
    expect(jendelaHalaman(1, 10)).toEqual([1, 2, "…", 10]);
    expect(jendelaHalaman(10, 10)).toEqual([1, "…", 9, 10]);
  });
});
