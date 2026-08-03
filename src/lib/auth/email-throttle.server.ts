// Pembatas kirim-ulang email, bersandar pada database.
//
// Menggantikan dua pembatas yang sebelumnya tidak saling tahu: cooldown di
// localStorage browser dan penghitung di memori proses. Keduanya hilang begitu
// keadaannya berubah — ganti perangkat, bersihkan data, restart pm2 — dan
// angkanya pun berbeda satu sama lain.
//
// Pembatas di memori (rate-limit.server.ts) tetap dipakai untuk percobaan
// login, di mana kecepatan lebih penting daripada berbagi keadaan dan tidak ada
// tampilan yang perlu disinkronkan.

import { run } from "@/lib/db/pool.server";

const OWNER = { rls: false } as const;

/** Cooldown antar-kiriman dalam detik, dipilih menurut jumlah kiriman sebelumnya. */
export const TANGGA_COOLDOWN = [60, 120, 300, 900, 1800];

/** Kuota dalam satu jendela geser. */
export const MAKS_KIRIM = 5;
export const JENDELA_DETIK = 60 * 60;

export type JenisKirim = "verifikasi" | "reset";

export interface StatusKirim {
  /** Detik tersisa sebelum kiriman berikutnya diizinkan. 0 berarti boleh sekarang. */
  sisaDetik: number;
  /** Jumlah kiriman di dalam jendela geser. */
  terpakai: number;
  maks: number;
}

export interface HasilKirim extends StatusKirim {
  diizinkan: boolean;
}

/**
 * Email dinormalkan di satu tempat.
 *
 * Tanpa ini "Budi@Contoh.com" dan "budi@contoh.com" menjadi dua baris dengan
 * kuota masing-masing, dan batasnya bisa dilipatgandakan hanya dengan mengubah
 * kapitalisasi.
 */
function normalkan(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Mencatat satu percobaan dan mengembalikan keputusannya.
 *
 * SELALU dipanggil, termasuk untuk email yang tidak punya akun atau sudah
 * terverifikasi. Kalau pencatatan dilewati untuk email tak dikenal, cooldown
 * yang terlihat pengguna akan berbeda antara email yang ada dan tidak ada —
 * dan tombol kirim-ulang berubah menjadi alat untuk memeriksa keberadaan akun.
 */
export async function catatKirim(jenis: JenisKirim, email: string): Promise<HasilKirim> {
  const rows = await run<{
    diizinkan: boolean;
    sisa_detik: number;
    terpakai: number;
    maks: number;
  }>(
    "SELECT * FROM auth.catat_kirim_email($1, $2, $3, $4, $5)",
    [jenis, normalkan(email), JENDELA_DETIK, MAKS_KIRIM, TANGGA_COOLDOWN],
    OWNER,
  );

  const r = rows[0];
  // Kalau fungsinya tidak mengembalikan apa pun, gagal TERTUTUP. Membiarkan
  // kiriman lewat saat pembatas bermasalah mengubah gangguan database menjadi
  // saluran pengiriman email gratis.
  if (!r)
    return { diizinkan: false, sisaDetik: JENDELA_DETIK, terpakai: MAKS_KIRIM, maks: MAKS_KIRIM };

  return { diizinkan: r.diizinkan, sisaDetik: r.sisa_detik, terpakai: r.terpakai, maks: r.maks };
}

export type HasilPercobaan = "diizinkan" | "ditolak_cooldown" | "ditolak_kuota" | "ditolak_ip";

/**
 * Menurunkan sebab penolakan dari angka yang dikembalikan pembatas.
 *
 * Dibedakan karena keduanya menuntut tindakan berbeda saat ditinjau: cooldown
 * berarti orangnya menekan tombol terlalu cepat, kuota habis berarti alamat itu
 * sudah lima kali diminta dalam sejam — pola yang pantas dicurigai.
 */
export function sebabPenolakan(hasil: HasilKirim): HasilPercobaan {
  if (hasil.diizinkan) return "diizinkan";
  return hasil.terpakai >= hasil.maks ? "ditolak_kuota" : "ditolak_cooldown";
}

/**
 * Mencatat satu percobaan ke riwayat yang bisa ditinjau admin.
 *
 * Terpisah dari catatKirim yang menghitung kuota: yang satu menegakkan batas,
 * yang ini menyimpan jejaknya. Menggabungkannya akan membuat fungsi kuota
 * menulis dua tabel dan gagal di salah satunya menjadi ambigu.
 *
 * Tidak pernah melempar — sama seperti perekam audit lain. Kegagalan mencatat
 * tidak boleh menggagalkan permintaan yang dicatatnya.
 */
export async function catatPercobaan(catatan: {
  jenis: JenisKirim;
  email: string;
  hasil: HasilPercobaan;
  emailDikirim: boolean;
  sisaDetik: number;
  terpakai: number;
  ip: string | null;
}): Promise<void> {
  try {
    await run(
      "SELECT public.catat_percobaan_kirim($1, $2, $3, $4, $5, $6, $7)",
      [
        catatan.jenis,
        normalkan(catatan.email),
        catatan.hasil,
        catatan.emailDikirim,
        catatan.sisaDetik,
        catatan.terpakai,
        catatan.ip,
      ],
      OWNER,
    );
  } catch (error) {
    console.error("percobaan kirim gagal dicatat", error);
  }
}

/** Membaca status untuk ditampilkan, tanpa mencatat percobaan. */
export async function statusKirim(jenis: JenisKirim, email: string): Promise<StatusKirim> {
  const rows = await run<{ sisa_detik: number; terpakai: number; maks: number }>(
    "SELECT * FROM auth.status_kirim_email($1, $2, $3, $4, $5)",
    [jenis, normalkan(email), JENDELA_DETIK, MAKS_KIRIM, TANGGA_COOLDOWN],
    OWNER,
  );

  const r = rows[0];
  if (!r) return { sisaDetik: 0, terpakai: 0, maks: MAKS_KIRIM };
  return { sisaDetik: r.sisa_detik, terpakai: r.terpakai, maks: r.maks };
}
