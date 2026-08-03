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

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: emailSchema }).parse(input))
  .handler(async ({ data }): Promise<HasilAuth> => {
    const batas = batasi(kunciLaju("reset", data.email), 5, 60 * 60);
    // Bahkan saat dibatasi, jawabannya tetap sama supaya batas laju tidak
    // berubah menjadi cara memeriksa keberadaan akun.
    if (batas.diizinkan) {
      const siap = await siapkanReset(data.email);
      if (siap) await kirimEmailReset(data.email, siap.token);
    }
    return { ok: true };
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

export const resendVerification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: emailSchema }).parse(input))
  .handler(async ({ data }): Promise<HasilAuth> => {
    const batas = batasi(kunciLaju("verifikasi-ulang", data.email), 3, 60 * 60);
    if (batas.diizinkan) {
      const token = await tokenVerifikasiUlang(data.email);
      if (token) await kirimEmailVerifikasi(data.email, token);
    }
    // Sama seperti reset: jawaban seragam apa pun keadaannya.
    return { ok: true };
  });
