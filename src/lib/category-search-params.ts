import { fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

// Skema search param halaman kategori — dipakai rute untuk validasi DAN diuji
// langsung sebagai regresi.
//
// TIPE SENGAJA DIPILIH AGAR URL TETAP BERSIH DAN FILTER BERTAHAN. Parser search
// TanStack mengoersi nilai yang tampak angka menjadi number, dan stringifier-nya
// membungkus string yang tampak angka dengan tanda kutip (mis. min="500000").
//   • min/max/rating/page = NUMBER → URL bersih `?min=500000` tanpa kutip, dan
//     tidak gagal validasi lalu ter-strip (bug lama: min z.string() menolak angka
//     → jatuh ke default → hilang saat URL dibagikan/dibuka ulang). 0 = tak ada
//     filter (default, di-strip dari URL).
//   • q = z.coerce.string() → pencarian teks apa adanya; pencarian numerik langka
//     ikut bertahan (dibungkus kutip), lebih baik daripada hilang total.

export const categorySearchSchema = z.object({
  q: fallback(z.coerce.string(), "").default(""),
  min: fallback(z.number().min(0), 0).default(0),
  max: fallback(z.number().min(0), 0).default(0),
  rating: fallback(z.number(), 0).default(0),
  sort: fallback(z.string(), "popular").default("popular"),
  // Halaman default 1 dan di-strip dari URL saat = 1, jadi halaman pertama
  // selalu URL telanjang tanpa ?page=1.
  page: fallback(z.number().int().min(1), 1).default(1),
});

export type CategorySearch = z.infer<typeof categorySearchSchema>;

/** Nilai default = yang di-strip dari URL. Satu sumber untuk skema & middleware. */
export const CATEGORY_SEARCH_DEFAULTS = {
  q: "",
  min: 0,
  max: 0,
  rating: 0,
  sort: "popular",
  page: 1,
} as const;
