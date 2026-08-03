import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  daftar,
  masuk,
  resetPassword as resetPasswordAkun,
  siapkanReset,
  tokenVerifikasiUlang,
  verifikasiEmail,
} from "./accounts.server";
import { kirimEmailReset, kirimEmailVerifikasi } from "./mailer.server";
import { batasi, reset as resetBatas } from "./rate-limit.server";
import { requireAuth } from "./middleware.server";
import { createSession, destroySession, getSessionUser, type SessionUser } from "./session.server";

// Permukaan autentikasi milik sendiri. BELUM dipakai UI — pemasangannya
// menyusul setelah 28 pemanggilan supabase.auth.* diganti.
//
// Semua fungsi mengembalikan hasil bertipe, bukan melempar, kecuali untuk
// kesalahan yang memang tak terduga. Alur login yang melempar akan
// membocorkan keadaan lewat kode status.

const emailSchema = z.string().trim().toLowerCase().email().max(255);

// Panjang minimum 8 mengikuti anjuran NIST. Batas atas ada karena scrypt
// memproses seluruh masukan: tanpa itu, satu permintaan berisi password
// sepanjang megabyte menjadi jalur penghabisan CPU.
const passwordSchema = z.string().min(8, "Password minimal 8 karakter").max(200);

const tokenSchema = z.string().trim().min(20).max(200);

/** Kunci pembatas laju digabung dengan IP supaya satu penyerang tidak mengunci akun orang lain. */
function kunciLaju(prefix: string, nilai: string): string {
  const ip = getRequest()?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "tanpa-ip";
  return `${prefix}:${ip}:${nilai}`;
}

export type HasilAuth = { ok: true } | { ok: false; pesan: string };

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: emailSchema, password: passwordSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<HasilAuth> => {
    const batas = batasi(kunciLaju("daftar", data.email), 5, 60 * 60);
    if (!batas.diizinkan) {
      return {
        ok: false,
        pesan: `Terlalu banyak percobaan. Coba lagi dalam ${batas.sisaDetik} detik.`,
      };
    }

    const hasil = await daftar(data.email, data.password);

    // Email yang sudah terpakai TIDAK dibedakan dari pendaftaran berhasil.
    // Membedakannya membuat formulir pendaftaran jadi alat pemeriksa keberadaan
    // akun. Pemilik email yang sah tetap mendapat kejelasan lewat kotak masuk:
    // pendaftaran baru mengirim tautan verifikasi, yang sudah ada tidak.
    if (!hasil.ok) return { ok: true };

    await kirimEmailVerifikasi(data.email, hasil.tokenVerifikasi);
    return { ok: true };
  });

export type HasilMasukFn =
  | { ok: true; user: SessionUser }
  | { ok: false; kode: "kredensial_salah" | "belum_verifikasi" | "terlalu_sering"; pesan: string };

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: emailSchema, password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<HasilMasukFn> => {
    const kunci = kunciLaju("masuk", data.email);
    const batas = batasi(kunci, 10, 15 * 60);
    if (!batas.diizinkan) {
      return {
        ok: false,
        kode: "terlalu_sering",
        pesan: `Terlalu banyak percobaan masuk. Coba lagi dalam ${batas.sisaDetik} detik.`,
      };
    }

    const hasil = await masuk(data.email, data.password);
    if (!hasil.ok) {
      if (hasil.alasan === "belum_verifikasi") {
        return {
          ok: false,
          kode: "belum_verifikasi",
          pesan: "Email belum diverifikasi. Cek kotak masuk Anda.",
        };
      }
      return { ok: false, kode: "kredensial_salah", pesan: "Email atau password salah." };
    }

    resetBatas(kunci);
    await createSession(hasil.user.id);
    return { ok: true, user: { ...hasil.user } };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async (): Promise<HasilAuth> => {
  await destroySession();
  return { ok: true };
});

/** Pengganti useAuth: mengembalikan pengguna sesi saat ini, atau null. */
export const me = createServerFn({ method: "GET" }).handler(async (): Promise<SessionUser | null> =>
  getSessionUser(),
);

/**
 * Permintaan tautan reset password.
 *
 * Memakai pembatas dan pola jawaban yang sama persis dengan resendVerification
 * di bawah — termasuk alasan-alasannya, yang ditulis lengkap di sana. Kuotanya
 * TERPISAH: jenis "reset" punya jatah sendiri, supaya orang yang kehabisan
 * kiriman verifikasi tidak ikut kehilangan jalan untuk memulihkan passwordnya.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: emailSchema }).parse(input))
  .handler(async ({ data }): Promise<HasilKirimUlang> => {
    const { catatKirim, statusKirim } = await import("./email-throttle.server");

    const perIp = batasi(kunciLaju("reset-ip", ""), 20, 60 * 60);
    if (!perIp.diizinkan) {
      const status = await statusKirim("reset", data.email);
      return {
        ok: true,
        diizinkan: false,
        sisaDetik: Math.max(perIp.sisaDetik, status.sisaDetik),
        terpakai: status.terpakai,
        maks: status.maks,
      };
    }

    const hasil = await catatKirim("reset", data.email);
    if (hasil.diizinkan) {
      const siap = await siapkanReset(data.email);
      if (siap) await kirimEmailReset(data.email, siap.token);
    }

    return {
      ok: true,
      diizinkan: hasil.diizinkan,
      sisaDetik: hasil.sisaDetik,
      terpakai: hasil.terpakai,
      maks: hasil.maks,
    };
  });

/** Status cooldown reset password. Alasan POST sama seperti verificationCooldown. */
export const passwordResetCooldown = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: emailSchema }).parse(input))
  .handler(async ({ data }) => {
    const { statusKirim } = await import("./email-throttle.server");
    return statusKirim("reset", data.email);
  });

export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: tokenSchema, password: passwordSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<HasilAuth> => {
    const hasil = await resetPasswordAkun(data.token, data.password);
    if (!hasil.ok) {
      return { ok: false, pesan: "Tautan reset tidak berlaku atau sudah kedaluwarsa." };
    }
    return { ok: true };
  });

export const verifyEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }): Promise<HasilAuth> => {
    if (!(await verifikasiEmail(data.token))) {
      return { ok: false, pesan: "Tautan verifikasi tidak berlaku atau sudah kedaluwarsa." };
    }
    return { ok: true };
  });

/**
 * Hasil permintaan kiriman email — dipakai kirim-ulang verifikasi maupun reset
 * password, karena keduanya menghadapi persoalan yang sama.
 *
 * ok SELALU true. Yang membedakan hanya angka cooldown, dan angka itu berasal
 * dari alamat email sebagai teks — bukan dari ada-tidaknya akun. Jawaban yang
 * membedakan keduanya akan mengubah tombol ini menjadi alat pemeriksa akun.
 */
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

/**
 * DUA LAPIS PEMBATAS, dengan tugas berbeda.
 *
 * Lapis email (di database) adalah yang menjaga KOTAK MASUK korban. Ia sengaja
 * TIDAK memakai IP, karena itulah yang membuatnya konsisten lintas perangkat —
 * permintaan yang sama dari ponsel dan laptop berbagi kuota yang sama.
 *
 * Harganya jujur: siapa pun yang tahu alamat email seseorang bisa menghabiskan
 * jatah kirim-ulangnya selama satu jam. Itu diterima secara sadar, karena
 * ancaman yang lebih besar adalah membanjiri kotak masuk korban dengan puluhan
 * email verifikasi — dan pembatas ber-IP tidak menahannya sama sekali, penyerang
 * tinggal berganti IP. Korban yang terkena tetap bisa memakai tautan yang sudah
 * dikirim sebelumnya.
 *
 * Lapis IP (di memori) menjaga hal yang berbeda: satu sumber tidak bisa
 * menghabiskan jatah BANYAK alamat sekaligus. Batasnya longgar supaya satu
 * kantor atau rumah dengan IP bersama tidak ikut terkena.
 */
export const resendVerification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: emailSchema }).parse(input))
  .handler(async ({ data }): Promise<HasilKirimUlang> => {
    const { catatKirim, statusKirim } = await import("./email-throttle.server");

    const perIp = batasi(kunciLaju("verifikasi-ulang-ip", ""), 20, 60 * 60);
    if (!perIp.diizinkan) {
      // Tidak dicatat sebagai percobaan pada alamat itu — tidak ada email yang
      // dikirim, jadi kuota alamatnya tidak pantas berkurang. Yang dilaporkan
      // adalah tunggu terlama di antara kedua lapis, supaya hitungan mundur di
      // layar tidak berakhir sebelum tombolnya benar-benar bisa dipakai.
      const status = await statusKirim("verifikasi", data.email);
      return {
        ok: true,
        diizinkan: false,
        sisaDetik: Math.max(perIp.sisaDetik, status.sisaDetik),
        terpakai: status.terpakai,
        maks: status.maks,
      };
    }

    const hasil = await catatKirim("verifikasi", data.email);
    if (hasil.diizinkan) {
      const token = await tokenVerifikasiUlang(data.email);
      if (token) await kirimEmailVerifikasi(data.email, token);
    }

    return {
      ok: true,
      diizinkan: hasil.diizinkan,
      sisaDetik: hasil.sisaDetik,
      terpakai: hasil.terpakai,
      maks: hasil.maks,
    };
  });

/**
 * Status cooldown untuk ditampilkan saat halaman dibuka, tanpa mencatat apa pun.
 *
 * Menerima alamat sembarang karena halaman /verify-email dipakai orang yang
 * belum masuk. Aman: hitungannya berasal dari alamat sebagai teks dan naik
 * untuk email tak dikenal juga, jadi tidak membedakan akun yang ada dari yang
 * tidak.
 *
 * POST meski hanya membaca. Server function GET menaruh masukannya di URL, dan
 * URL tercatat utuh di log akses nginx — alamat email setiap pengunjung halaman
 * verifikasi akan tersimpan di sana tanpa alasan.
 */
export const verificationCooldown = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: emailSchema }).parse(input))
  .handler(async ({ data }) => {
    const { statusKirim } = await import("./email-throttle.server");
    return statusKirim("verifikasi", data.email);
  });

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ current: z.string().min(1).max(200), next: passwordSchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<HasilAuth> => {
    const { gantiPassword } = await import("./accounts.server");
    const hasil = await gantiPassword(context.userId, data.current, data.next);
    if (!hasil.ok) {
      return { ok: false, pesan: "Password saat ini salah." };
    }

    // Perangkat lain dikeluarkan, perangkat ini tidak: pemiliknya baru saja
    // membuktikan diri dengan password lama.
    const { destroyAllSessions, createSession } = await import("./session.server");
    await destroyAllSessions(context.userId);
    await createSession(context.userId);

    return { ok: true };
  });
