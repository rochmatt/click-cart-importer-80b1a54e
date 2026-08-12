// Urut & saring untuk halaman direktori "Semua Kategori" (/categories).
//
// Dipisah dari rute agar logikanya bisa diuji tanpa render. Ambang rentang
// jumlah mengikuti desain mock Antigravity (0-50 / 51-200 / >200) — dibuat untuk
// katalog besar; dengan data statis app saat ini (1-3 produk/kategori) hanya
// bucket "0-50" yang terisi, itu perilaku yang benar, bukan bug.

export type UrutKategori = "popular" | "az" | "za";
export type RentangJumlah = "all" | "0-50" | "51-200" | "200+";

/** Apakah `count` produk masuk bucket rentang terpilih. "all"/tak dikenal = ya. */
export function dalamRentangJumlah(count: number, rentang: RentangJumlah): boolean {
  switch (rentang) {
    case "0-50":
      return count <= 50;
    case "51-200":
      return count >= 51 && count <= 200;
    case "200+":
      return count > 200;
    default:
      return true;
  }
}

/**
 * Salinan terurut. "popular" = jumlah produk terbanyak dulu (app tak punya
 * metrik popularitas lain); "az"/"za" = alfabet label (locale id, case-insensitif).
 */
export function urutkanKategori<T extends { label: string; count: number }>(
  items: readonly T[],
  urut: UrutKategori,
): T[] {
  const arr = [...items];
  switch (urut) {
    case "az":
      return arr.sort((a, b) => a.label.localeCompare(b.label, "id", { sensitivity: "base" }));
    case "za":
      return arr.sort((a, b) => b.label.localeCompare(a.label, "id", { sensitivity: "base" }));
    default:
      // popular: count desc, seri dipecah alfabet agar urutan stabil.
      return arr.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "id"));
  }
}
