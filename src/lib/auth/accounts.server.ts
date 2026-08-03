// Operasi akun: daftar, masuk, reset password, verifikasi email.
//
// Dipisahkan dari server function supaya bisa diuji tanpa siklus permintaan
// HTTP, dan supaya keputusan keamanannya terbaca di satu tempat.

import { run } from "@/lib/db/pool.server";
import { hashPassword, needsRehash, verifyPassword } from "./password.server";
import { consumeToken, createToken } from "./tokens.server";

const OWNER = { rls: false } as const;

/**
 * Hash umpan untuk email yang tidak terdaftar.
 *
 * Tanpa ini, login dengan email tak dikenal langsung kembali sementara email
 * terdaftar menunggu ~400 ms scrypt. Selisih itu cukup untuk memetakan siapa
 * saja yang punya akun. Nilainya dihitung sekali saat modul dimuat.
 */
let hashUmpan: Promise<string> | null = null;
function umpan(): Promise<string> {
  hashUmpan ??= hashPassword(`umpan-${Math.random()}`);
  return hashUmpan;
}

export interface AkunUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

interface BarisUser {
  id: string;
  email: string;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
}

async function cariUser(email: string): Promise<BarisUser | null> {
  const rows = await run<BarisUser>(
    "SELECT id, email, encrypted_password, email_confirmed_at FROM auth.users WHERE lower(email) = lower($1)",
    [email.trim()],
    OWNER,
  );
  return rows[0] ?? null;
}

export type HasilDaftar =
  { ok: true; userId: string; tokenVerifikasi: string } | { ok: false; alasan: "email_terpakai" };

/**
 * Mendaftarkan akun baru dan mengembalikan token verifikasi untuk dikirim email.
 *
 * Baris profiles ikut dibuat di transaksi yang sama secara logis: tanpa itu,
 * halaman akun menemukan profil kosong dan kode pemanggil harus menangani
 * keadaan yang sebenarnya tidak perlu ada.
 */
export async function daftar(email: string, password: string): Promise<HasilDaftar> {
  const bersih = email.trim().toLowerCase();
  if (await cariUser(bersih)) return { ok: false, alasan: "email_terpakai" };

  const hash = await hashPassword(password);

  let userId: string;
  try {
    const rows = await run<{ id: string }>(
      "INSERT INTO auth.users (email, encrypted_password) VALUES ($1, $2) RETURNING id",
      [bersih, hash],
      OWNER,
    );
    userId = rows[0].id;
  } catch (error) {
    // Indeks unik pada lower(email) menangkap balapan antara pemeriksaan di
    // atas dan penyisipan ini. Diperlakukan sama seperti email sudah terpakai.
    if ((error as { code?: string })?.code === "23505") {
      return { ok: false, alasan: "email_terpakai" };
    }
    throw error;
  }

  await run("INSERT INTO public.profiles (id) VALUES ($1) ON CONFLICT DO NOTHING", [userId], OWNER);

  return { ok: true, userId, tokenVerifikasi: await createToken(userId, "signup") };
}

export type HasilMasuk =
  { ok: true; user: AkunUser } | { ok: false; alasan: "kredensial_salah" | "belum_verifikasi" };

/**
 * Memeriksa kredensial. TIDAK membuat sesi — itu tugas pemanggil, supaya modul
 * ini bebas dari siklus permintaan HTTP.
 *
 * Email tak dikenal dan password salah menghasilkan alasan yang SAMA. Pesan
 * yang berbeda akan mengubah halaman login menjadi alat pemeriksa keberadaan
 * akun.
 */
export async function masuk(email: string, password: string): Promise<HasilMasuk> {
  const user = await cariUser(email);

  if (!user) {
    // Tetap jalankan scrypt supaya waktu tanggapnya setara.
    await verifyPassword(password, await umpan());
    return { ok: false, alasan: "kredensial_salah" };
  }

  if (!(await verifyPassword(password, user.encrypted_password))) {
    return { ok: false, alasan: "kredensial_salah" };
  }

  if (!user.email_confirmed_at) return { ok: false, alasan: "belum_verifikasi" };

  // Biaya hashing dinaikkan lewat pembaruan kode; password lama ikut naik saat
  // pemiliknya login, tanpa perlu mereset apa pun.
  if (needsRehash(user.encrypted_password)) {
    await run(
      "UPDATE auth.users SET encrypted_password = $2, updated_at = now() WHERE id = $1",
      [user.id, await hashPassword(password)],
      OWNER,
    );
  }

  await run("UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1", [user.id], OWNER);

  return {
    ok: true,
    user: { id: user.id, email: user.email, emailConfirmed: true },
  };
}

/** Menandai email terverifikasi. Token yang tidak sah menghasilkan false. */
export async function verifikasiEmail(token: string): Promise<boolean> {
  const hasil = await consumeToken(token, "signup");
  if (!hasil) return false;
  await run(
    "UPDATE auth.users SET email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() WHERE id = $1",
    [hasil.userId],
    OWNER,
  );
  return true;
}

/**
 * Menyiapkan reset password.
 *
 * Mengembalikan null untuk email tak dikenal, dan pemanggil WAJIB tetap
 * menjawab seolah berhasil — kalau tidak, halaman lupa-password menjadi alat
 * pemeriksa keberadaan akun.
 */
export async function siapkanReset(
  email: string,
): Promise<{ userId: string; token: string } | null> {
  const user = await cariUser(email);
  if (!user) return null;
  return { userId: user.id, token: await createToken(user.id, "recovery") };
}

export type HasilReset = { ok: true } | { ok: false; alasan: "token_tidak_sah" };

/**
 * Menetapkan password baru dan MENCABUT SELURUH SESI pemiliknya.
 *
 * Pencabutan itu bagian dari kebenaran, bukan tambahan: kalau seseorang mereset
 * password justru karena akunnya diambil alih, penyerang yang masih punya sesi
 * aktif akan tetap masuk tanpa perlu tahu password barunya.
 */
export async function resetPassword(token: string, passwordBaru: string): Promise<HasilReset> {
  const hasil = await consumeToken(token, "recovery");
  if (!hasil) return { ok: false, alasan: "token_tidak_sah" };

  await run(
    `UPDATE auth.users
        SET encrypted_password = $2,
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            updated_at = now()
      WHERE id = $1`,
    [hasil.userId, await hashPassword(passwordBaru)],
    OWNER,
  );

  const { destroyAllSessions } = await import("./session.server");
  await destroyAllSessions(hasil.userId);

  return { ok: true };
}

/** Untuk mengirim ulang email verifikasi. null kalau akun tidak ada atau sudah terverifikasi. */
export async function tokenVerifikasiUlang(email: string): Promise<string | null> {
  const user = await cariUser(email);
  if (!user || user.email_confirmed_at) return null;
  return createToken(user.id, "signup");
}
