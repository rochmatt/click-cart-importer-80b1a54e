// Pagination kategori dan metadata SEO-nya.
//
// Dipisah dari rute agar logika URL kanonik / prev / next bisa diuji tuntas
// tanpa runtime router. Tujuannya satu: tiap halaman pagination punya SATU URL
// kanonik yang menunjuk DIRINYA SENDIRI, sehingga mesin pencari tidak
// memperlakukan halaman-halaman itu sebagai konten duplikat dan produk di
// halaman dalam tetap terindeks.

export const CATEGORY_PAGE_SIZE = 24;

export interface HalamanKategori {
  /** Halaman aktif setelah dijepit ke [1, totalPages]. */
  page: number;
  /** Total halaman — minimal 1, walau kategori kosong. */
  totalPages: number;
  /** Slice item untuk halaman ini: [start, end), 0-based, end eksklusif. */
  start: number;
  end: number;
}

/** Menjepit halaman yang diminta ke rentang valid dan menghitung slice-nya. */
export function hitungHalaman(
  totalItems: number,
  requested: number,
  pageSize = CATEGORY_PAGE_SIZE,
): HalamanKategori {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requested) || 1), totalPages);
  const start = (page - 1) * pageSize;
  return { page, totalPages, start, end: start + pageSize };
}

/**
 * URL kategori untuk sebuah halaman. Halaman 1 SELALU tanpa `?page` — kalau
 * tidak, `/category/x` dan `/category/x?page=1` menjadi dua URL untuk konten
 * yang sama, persis duplikasi yang ingin dicegah. `origin` boleh kosong untuk
 * menghasilkan URL relatif.
 */
export function urlHalamanKategori(origin: string, slug: string, page: number): string {
  const base = `${origin}/category/${slug}`;
  return page <= 1 ? base : `${base}?page=${page}`;
}

export interface MetaPaginationKategori {
  /** Untuk <link> di head: canonical selalu ada; prev/next hanya bila tetangganya ada. */
  links: Array<{ rel: "canonical" | "prev" | "next"; href: string }>;
  /** Sisipan judul: "" untuk halaman 1, " — Halaman N dari M" selebihnya. */
  labelJudul: string;
  /** Sisipan deskripsi: "" untuk halaman 1, " Halaman N dari M." selebihnya. */
  labelDeskripsi: string;
}

/**
 * Metadata SEO untuk satu halaman pagination kategori.
 *
 * canonical menunjuk DIRI halaman itu (bukan selalu halaman 1) supaya produk di
 * halaman dalam tetap terindeks; prev/next merangkai urutannya. Halaman 1 tidak
 * pernah memancarkan prev, dan halaman terakhir tidak memancarkan next.
 */
export function metaPaginationKategori(
  origin: string,
  slug: string,
  page: number,
  totalPages: number,
): MetaPaginationKategori {
  const links: MetaPaginationKategori["links"] = [
    { rel: "canonical", href: urlHalamanKategori(origin, slug, page) },
  ];
  if (page > 1) links.push({ rel: "prev", href: urlHalamanKategori(origin, slug, page - 1) });
  if (page < totalPages) {
    links.push({ rel: "next", href: urlHalamanKategori(origin, slug, page + 1) });
  }
  return {
    links,
    labelJudul: page > 1 ? ` — Halaman ${page} dari ${totalPages}` : "",
    labelDeskripsi: page > 1 ? ` Halaman ${page} dari ${totalPages}.` : "",
  };
}

/**
 * Deretan nomor halaman untuk kontrol UI. Sampai 7 halaman ditampilkan penuh;
 * di atas itu dijendela ke [1, sekitar aktif, terakhir] dengan "…" sebagai jeda.
 */
export function jendelaHalaman(page: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const inti = [1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages);
  const urut = Array.from(new Set(inti)).sort((a, b) => a - b);
  const keluar: Array<number | "…"> = [];
  let sebelum = 0;
  for (const n of urut) {
    if (n - sebelum > 1) keluar.push("…");
    keluar.push(n);
    sebelum = n;
  }
  return keluar;
}
