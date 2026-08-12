// Filter produk untuk Discover Feed beranda (kategori + rating + rentang harga).
//
// Logika murni dipisah dari komponen agar bisa diuji tanpa render. Harga produk
// disimpan sebagai string ("Rp 549.000"), jadi diurai ke angka di sini.

import type { Product } from "@/data/products";

export interface FeedFilter {
  /** "all" atau label kategori persis (p.category). */
  category: string;
  /** Rating minimum: 0 = semua, mis. 3 atau 4. */
  minRating: number;
  /** Batas harga rupiah; 0 = tak ada batas. */
  minPrice: number;
  maxPrice: number;
}

export const FEED_FILTER_KOSONG: FeedFilter = {
  category: "all",
  minRating: 0,
  minPrice: 0,
  maxPrice: 0,
};

export const hargaProduk = (price: string): number => Number(price.replace(/[^\d]/g, "")) || 0;

export type FeedSort = "relevance" | "price_asc" | "price_desc";

/**
 * Urutkan feed. "relevance" mempertahankan urutan masuk (dari tab/relevansi);
 * price_asc/price_desc mengurutkan berdasar harga. Salinan, tak memutasi input.
 */
export function urutkanFeed<T extends { price: string }>(list: readonly T[], sort: FeedSort): T[] {
  if (sort === "relevance") return [...list];
  const arr = [...list];
  arr.sort((a, b) =>
    sort === "price_asc"
      ? hargaProduk(a.price) - hargaProduk(b.price)
      : hargaProduk(b.price) - hargaProduk(a.price),
  );
  return arr;
}

/** Apakah produk lolos SEMUA filter aktif. */
export function cocokFilterFeed(p: Product, f: FeedFilter): boolean {
  if (f.category !== "all" && p.category !== f.category) return false;
  if (f.minRating > 0 && p.rating < f.minRating) return false;
  const harga = hargaProduk(p.price);
  if (f.minPrice > 0 && harga < f.minPrice) return false;
  if (f.maxPrice > 0 && harga > f.maxPrice) return false;
  return true;
}

export function feedFilterAktif(f: FeedFilter): boolean {
  return f.category !== "all" || f.minRating > 0 || f.minPrice > 0 || f.maxPrice > 0;
}

const rp = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(n)}`;

/** Chip filter aktif untuk tampilan visual (bisa dihapus per item). */
export function chipFilterFeed(
  f: FeedFilter,
): Array<{ key: "category" | "minRating" | "price"; label: string }> {
  const chips: Array<{ key: "category" | "minRating" | "price"; label: string }> = [];
  if (f.category !== "all") chips.push({ key: "category", label: f.category });
  if (f.minRating > 0) chips.push({ key: "minRating", label: `Rating ${f.minRating}+` });
  if (f.minPrice > 0 || f.maxPrice > 0) {
    const label =
      f.minPrice > 0 && f.maxPrice > 0
        ? `${rp(f.minPrice)}–${rp(f.maxPrice)}`
        : f.minPrice > 0
          ? `≥ ${rp(f.minPrice)}`
          : `≤ ${rp(f.maxPrice)}`;
    chips.push({ key: "price", label });
  }
  return chips;
}

/** Narasi untuk region aria-live (dibaca screen reader). */
export function ringkasanFilterFeed(f: FeedFilter, jumlah: number): string {
  const bagian: string[] = [];
  if (f.category !== "all") bagian.push(`kategori ${f.category}`);
  if (f.minRating > 0) bagian.push(`rating ${f.minRating} bintang ke atas`);
  if (f.minPrice > 0 && f.maxPrice > 0)
    bagian.push(`harga ${rp(f.minPrice)} hingga ${rp(f.maxPrice)}`);
  else if (f.minPrice > 0) bagian.push(`harga mulai ${rp(f.minPrice)}`);
  else if (f.maxPrice > 0) bagian.push(`harga hingga ${rp(f.maxPrice)}`);

  const produk = `Menampilkan ${jumlah} produk.`;
  return bagian.length === 0
    ? `Tidak ada filter aktif. ${produk}`
    : `Filter aktif: ${bagian.join(", ")}. ${produk}`;
}
