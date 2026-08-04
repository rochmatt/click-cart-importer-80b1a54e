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
