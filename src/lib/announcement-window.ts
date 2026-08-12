// Logika jendela penjadwalan pengumuman — kapan sebuah pengumuman tayang.
//
// Dipisahkan dari content.functions.ts supaya bisa diuji tanpa runtime server
// function. Filter ini dulu inline di fetchAnnouncements, dan menentukan kapan
// banner promo muncul dan hilang — persis bagian yang paling perlu dikunci tes.
//
// KONSISTENSI TIMEZONE. starts_at/ends_at adalah timestamptz, dan node-pg
// mengembalikannya sebagai string ISO UTC ber-Z (mis. "2026-08-04T02:00:00.000Z").
// Date.parse atas string itu menghasilkan instan absolut yang sama tanpa
// memandang zona waktu server, dan Date.now() juga absolut. Jadi perbandingannya
// membandingkan dua INSTAN, bukan dua jam dinding — tidak ada tempat bagi offset
// zona untuk menyelinap. Yang penting: masukannya HARUS string ber-offset;
// string tanpa offset akan ditafsirkan sebagai waktu lokal dan merusak ini.
// Itulah yang diuji round-trip di announcement-window.test.ts.

export interface JendelaPengumuman {
  is_active: boolean;
  /** ISO ber-offset. Boleh kosong/null; kosong berarti "sudah mulai". */
  starts_at?: string | null;
  /** ISO ber-offset. null berarti "tidak pernah berakhir". */
  ends_at?: string | null;
}

/**
 * Apakah pengumuman tayang pada instan nowMs (epoch milidetik).
 *
 * Batasnya INKLUSIF di kedua ujung: pada detik tepat starts_at ia sudah tampil,
 * dan pada detik tepat ends_at ia belum hilang. Promo yang dijadwalkan "mulai
 * pukul 10:00" harus benar-benar muncul pada 10:00:00, bukan 10:00:01.
 *
 * Tanggal yang tak-terparse (NaN) diperlakukan sebagai TIDAK membatasi, bukan
 * membatasi: kalau starts_at rusak, lebih baik pengumuman tetap tampil daripada
 * hilang diam-diam karena satu baris data yang salah bentuk. is_active tetap
 * menjadi gerbang utamanya.
 */
export function pengumumanTampil(a: JendelaPengumuman, nowMs: number): boolean {
  if (!a.is_active) return false;

  if (a.starts_at) {
    const mulai = Date.parse(a.starts_at);
    if (!Number.isNaN(mulai) && mulai > nowMs) return false;
  }
  if (a.ends_at) {
    const berakhir = Date.parse(a.ends_at);
    if (!Number.isNaN(berakhir) && berakhir < nowMs) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// AUDIENCE TARGETING. Selain jendela jadwal, tiap pengumuman menyasar satu
// kelompok penonton. Predikat ini dan pengumumanTampil di atas adalah dua
// gerbang yang independen: sebuah pengumuman tayang hanya jika LOLOS keduanya.
// Dipisah supaya masing-masing bisa diuji tuntas tanpa runtime server.

/** Kelompok penonton yang bisa disasar satu pengumuman. */
export type AudiensPengumuman = "all" | "guest" | "member" | "admin" | "moderator";

/** Siapa yang sedang melihat — ditentukan server dari sesi, bukan browser. */
export interface PenontonPengumuman {
  /** Apakah penonton sudah login. admin/moderator selalu menyiratkan login. */
  loggedIn: boolean;
  /** Peran penonton (mis. ["admin"]). Kosong untuk tamu atau pengguna biasa. */
  roles?: readonly string[];
}

/**
 * Apakah pengumuman dengan sasaran `audience` boleh tampil untuk `penonton`.
 *
 * "member" berarti pengunjung login mana pun — jadi admin pun melihat pengumuman
 * member (admin juga seorang member). Sebaliknya "guest" hanya untuk yang BELUM
 * login, sehingga banner "daftar sekarang" tidak mengganggu yang sudah punya akun.
 *
 * Nilai yang tak dikenal (termasuk null/undefined dan data lama sebelum kolom
 * audience ada) diperlakukan sebagai "all" — sama filosofinya dengan
 * pengumumanTampil: lebih baik satu baris salah-bentuk tetap tampil ke semua
 * daripada hilang diam-diam.
 */
export function pengumumanUntukPenonton(
  audience: string | null | undefined,
  penonton: PenontonPengumuman,
): boolean {
  switch (audience) {
    case "guest":
      return !penonton.loggedIn;
    case "member":
      return penonton.loggedIn;
    case "admin":
      return penonton.loggedIn && (penonton.roles ?? []).includes("admin");
    case "moderator":
      return penonton.loggedIn && (penonton.roles ?? []).includes("moderator");
    default:
      return true; // "all" + nilai tak dikenal → tampil ke semua
  }
}
