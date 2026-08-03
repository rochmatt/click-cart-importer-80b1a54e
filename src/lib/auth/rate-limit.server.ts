// Pembatas laju di memori: percobaan login, pendaftaran, dan kuota per-IP.
//
// PERANNYA SUDAH MENYEMPIT. Batas pengiriman email — kirim ulang verifikasi dan
// permintaan reset password — pindah ke email-throttle.server.ts yang bersandar
// pada database, karena batas itu harus terlihat sama di semua perangkat dan
// bertahan melewati restart. Yang tersisa di sini adalah pembatas yang tidak
// perlu dibagi antar-perangkat dan tidak ditampilkan ke pengguna.
//
// BATASNYA JELAS DAN DISENGAJA: penghitungnya ada di memori proses, jadi ia
// hilang saat pm2 me-restart aplikasi dan tidak dibagi antar-proses. Itu dapat
// diterima untuk pemakaian yang tersisa karena pm2 menjalankan SATU instance
// fork untuk app ini. Kalau kelak dijalankan berkelompok, penghitung ini harus
// ikut pindah — kalau tidak, batasnya terbagi dan efektifnya melonggar.
//
// Ini bukan pengganti scrypt sebagai penahan utama; ia hanya membuat tebakan
// beruntun mahal secara waktu.

interface Jendela {
  hitung: number;
  resetPada: number;
}

const penghitung = new Map<string, Jendela>();

/** Membuang entri kedaluwarsa supaya Map tidak tumbuh tanpa batas. */
function sapu(sekarang: number): void {
  if (penghitung.size < 1000) return;
  for (const [kunci, j] of penghitung) {
    if (j.resetPada <= sekarang) penghitung.delete(kunci);
  }
}

export interface HasilBatas {
  diizinkan: boolean;
  sisaDetik: number;
}

/**
 * Menghitung satu percobaan. Mengembalikan diizinkan=false ketika kuota habis.
 *
 * Jendelanya tetap (fixed window), bukan geser: lebih sederhana dan cukup untuk
 * tujuannya. Konsekuensinya di pergantian jendela bisa terjadi lonjakan hingga
 * dua kali kuota — dapat diterima untuk kasus ini.
 */
export function batasi(kunci: string, maks: number, jendelaDetik: number): HasilBatas {
  const sekarang = Date.now();
  sapu(sekarang);

  const ada = penghitung.get(kunci);
  if (!ada || ada.resetPada <= sekarang) {
    penghitung.set(kunci, { hitung: 1, resetPada: sekarang + jendelaDetik * 1000 });
    return { diizinkan: true, sisaDetik: 0 };
  }

  ada.hitung += 1;
  if (ada.hitung > maks) {
    return { diizinkan: false, sisaDetik: Math.ceil((ada.resetPada - sekarang) / 1000) };
  }
  return { diizinkan: true, sisaDetik: 0 };
}

/** Dipanggil setelah login berhasil supaya percobaan yang sah tidak menumpuk. */
export function reset(kunci: string): void {
  penghitung.delete(kunci);
}

/** Hanya untuk tes. */
export function resetSemua(): void {
  penghitung.clear();
}
