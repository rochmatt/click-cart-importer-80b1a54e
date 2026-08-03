// Alur bersama kirim ulang verifikasi dan permintaan reset password.
//
// KENAPA MODUL SENDIRI, bukan tinggal di auth.functions.ts: server function
// TanStack tidak bisa dipanggil di luar runtime-nya — percobaan memanggilnya
// dari tes menjawab "No Start context found in AsyncLocalStorage". Padahal
// justru di sinilah keputusan pembatas dan pencatatannya bertemu, dan bagian
// itu yang paling pantas diuji. Dipisahkan supaya bisa dipanggil langsung.
//
// Modul ini sengaja TIDAK menyentuh getRequest: alamat IP diterima sebagai
// parameter. Dengan begitu ia tidak menuntut konteks permintaan sama sekali.

import { batasi } from "./rate-limit.server";
import {
  batalkanKirim,
  catatKirim,
  catatPercobaan,
  sebabPenolakan,
  statusKirim,
  type JenisKirim,
} from "./email-throttle.server";
import { EmailSendError } from "@/lib/email/resend.server";

export interface HasilKirimUlang {
  ok: true;
  /**
   * Apakah PEMBATAS mengizinkan percobaan ini — bukan apakah email benar-benar
   * terkirim. Kiriman nyata bergantung pada ada-tidaknya akun yang belum
   * terverifikasi, dan itu tidak pernah dilaporkan ke klien.
   */
  diizinkan: boolean;
  sisaDetik: number;
  terpakai: number;
  maks: number;
}

/** Kuota per IP: longgar, hanya untuk mencegah satu sumber menyerang banyak alamat. */
export const MAKS_PER_IP = 20;

/**
 * Menjalankan satu permintaan kirim ulang: memutuskan, mengirim, mencatat.
 *
 * Verifikasi dan reset memakai fungsi yang sama supaya PENCATATANNYA tidak bisa
 * melenceng antara kedua alur. Versi terpisah sebelumnya sudah pernah melenceng
 * dalam hal lain — angka batasnya — dan riwayat yang hanya lengkap di salah satu
 * alur lebih menyesatkan daripada tidak ada riwayat sama sekali.
 *
 * @param kirim Mengembalikan true kalau email sungguhan dikirim. false berarti
 *              pembatas mengizinkan tapi tidak ada yang layak dikirimi — akun
 *              tidak ada, atau sudah terverifikasi.
 */
export async function prosesKirimUlang(
  jenis: JenisKirim,
  email: string,
  ip: string | null,
  kirim: () => Promise<boolean>,
): Promise<HasilKirimUlang> {
  const perIp = batasi(`${jenis}-ip:${ip ?? "tanpa-ip"}`, MAKS_PER_IP, 60 * 60);

  if (!perIp.diizinkan) {
    // Kuota alamatnya sengaja TIDAK dikurangi: tidak ada email yang dikirim,
    // jadi tidak pantas ikut terpakai. Yang dilaporkan adalah tunggu terlama di
    // antara kedua lapis, supaya hitungan mundur di layar tidak berakhir
    // sebelum tombolnya benar-benar bisa dipakai.
    const status = await statusKirim(jenis, email);
    const sisaDetik = Math.max(perIp.sisaDetik, status.sisaDetik);

    await catatPercobaan({
      jenis,
      email,
      hasil: "ditolak_ip",
      emailDikirim: false,
      sisaDetik,
      terpakai: status.terpakai,
      ip,
    });

    return { ok: true, diizinkan: false, sisaDetik, terpakai: status.terpakai, maks: status.maks };
  }

  const hasil = await catatKirim(jenis, email);

  let emailDikirim = false;
  if (hasil.diizinkan) {
    try {
      emailDikirim = await kirim();
    } catch (error) {
      // PENCATATAN DILAKUKAN SEBELUM MELEMPAR ULANG. Sebelum ini, lemparan dari
      // layanan email melewati pencatatan sepenuhnya — sehingga percobaan yang
      // SUDAH memakan kuota tidak meninggalkan jejak apa pun. Justru itulah
      // kasus yang paling perlu dilihat saat menyelidiki keluhan email tidak
      // sampai.
      await catatPercobaan({
        jenis,
        email,
        hasil: sebabPenolakan(hasil),
        emailDikirim: false,
        sisaDetik: hasil.sisaDetik,
        terpakai: hasil.terpakai,
        ip,
        errorKirim: error instanceof Error ? error.message : String(error),
      });

      // 429 dan 5xx adalah gangguan di pihak penyedia, bukan kesalahan pengguna.
      // Jatahnya dikembalikan supaya ia bisa mencoba lagi seketika; tanpa ini,
      // gangguan Resend berubah menjadi cooldown 30 menit bagi orang yang tidak
      // melakukan apa-apa. Galat permanen sengaja TIDAK dikembalikan — mencoba
      // ulang tidak menolong, dan mengembalikannya membuka jalan menembak
      // berulang tanpa batas.
      if (error instanceof EmailSendError && error.retryable) {
        await batalkanKirim(jenis, email);
      }

      // Dilempar ulang: pemanggil di UI sudah punya jalur galatnya sendiri, dan
      // menelan kegagalan di sini akan menampilkan "email terkirim" untuk email
      // yang tidak pernah terkirim.
      throw error;
    }
  }

  await catatPercobaan({
    jenis,
    email,
    hasil: sebabPenolakan(hasil),
    emailDikirim,
    sisaDetik: hasil.sisaDetik,
    terpakai: hasil.terpakai,
    ip,
  });

  return {
    ok: true,
    diizinkan: hasil.diizinkan,
    sisaDetik: hasil.sisaDetik,
    terpakai: hasil.terpakai,
    maks: hasil.maks,
  };
}
