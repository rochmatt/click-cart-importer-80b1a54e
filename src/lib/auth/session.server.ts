// Sesi login: token acak di cookie httpOnly, hash-nya yang disimpan di database.
//
// BEDANYA DENGAN SUPABASE: Supabase menyimpan JWT di localStorage dan
// melampirkannya sebagai header Authorization lewat middleware klien. Apa pun
// yang bisa menjalankan JavaScript di halaman bisa membacanya — satu celah XSS
// berarti token dapat dicuri dan dipakai di tempat lain.
//
// Di sini token disimpan di cookie httpOnly, yang tidak terbaca JavaScript.
// Konsekuensinya cookie ikut terkirim otomatis pada setiap permintaan, jadi
// perlindungan CSRF menjadi wajib — dan itu sudah terpasang di src/start.ts
// lewat createCsrfMiddleware untuk server function.
//
// Yang disimpan di tabel adalah SHA-256 dari token, bukan tokennya. Kalau isi
// tabel auth.sessions bocor, isinya tidak bisa dipakai menyamar jadi siapa pun.
//
// SQL ditulis langsung, bukan lewat lapisan kompatibel di src/lib/db/client:
// tabelnya berada di schema `auth` sedangkan query builder itu sengaja hanya
// menerima identifier polos dan selalu menarget schema public. Untuk jalur
// sekritis ini, SQL yang terbaca apa adanya lebih baik daripada memperluas
// builder demi beberapa query.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { run } from "@/lib/db/pool.server";

export const SESSION_COOKIE = "pp_session";

/** 30 hari, absolut. Tidak diperpanjang otomatis supaya masa hidup terbatas. */
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Semua query auth memakai koneksi pemilik: schema auth tertutup bagi role aplikasi. */
const OWNER = { rls: false } as const;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64");
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  // Situs selalu dilayani lewat https di produksi; nginx yang menerminasi TLS.
  secure: true,
  // lax, bukan strict: strict membuat cookie tidak terkirim saat pengguna tiba
  // dari tautan email verifikasi, sehingga ia tampak belum login.
  sameSite: "lax" as const,
  path: "/",
};

export interface SessionUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

/**
 * Membuat sesi baru dan memasang cookie-nya.
 *
 * Token dikembalikan HANYA lewat cookie; nilainya tidak pernah masuk badan
 * respons supaya tidak tersimpan tanpa sengaja di state klien atau log.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const request = getRequest();

  await run(
    `INSERT INTO auth.sessions (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [
      userId,
      hashToken(token),
      (request?.headers.get("user-agent") ?? "").slice(0, 400),
      (request?.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim().slice(0, 60) ?? "",
      SESSION_TTL_SECONDS,
    ],
    OWNER,
  );

  setCookie(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_SECONDS });
}

/**
 * Mengembalikan pengguna pemilik sesi, atau null.
 *
 * Tidak melempar untuk sesi tidak sah — pemanggil yang memutuskan apakah itu
 * berarti 401 atau sekadar tampilan tamu.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;

  const rows = await run<{
    session_id: string;
    token_hash: string;
    kedaluwarsa: boolean;
    id: string;
    email: string;
    email_confirmed_at: string | null;
  }>(
    `SELECT s.id AS session_id, s.token_hash, s.expires_at <= now() AS kedaluwarsa,
            u.id, u.email, u.email_confirmed_at
       FROM auth.sessions s
       JOIN auth.users u ON u.id = s.user_id
      WHERE s.token_hash = $1`,
    [hashToken(token)],
    OWNER,
  );

  const row = rows[0];
  if (!row) return null;

  // Pembandingan ulang secara timing-safe. Pencarian di atas memakai indeks
  // unik pada hash, jadi ini bukan pertahanan utama — tapi murah dan menutup
  // kemungkinan pencocokan longgar kalau query kelak diubah.
  const a = Buffer.from(row.token_hash);
  const b = Buffer.from(hashToken(token));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (row.kedaluwarsa) {
    await run("DELETE FROM auth.sessions WHERE id = $1", [row.session_id], OWNER);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    emailConfirmed: Boolean(row.email_confirmed_at),
  };
}

/** Menghapus sesi saat ini dan cookie-nya. Aman dipanggil tanpa sesi aktif. */
export async function destroySession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    await run("DELETE FROM auth.sessions WHERE token_hash = $1", [hashToken(token)], OWNER);
  }
  setCookie(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

/**
 * Mencabut seluruh sesi milik satu pengguna. Dipakai setelah ganti password
 * agar perangkat lain ikut keluar — tanpa ini, penyerang yang sudah masuk
 * tetap bertahan meski korban sudah mengganti passwordnya.
 */
export async function destroyAllSessions(userId: string): Promise<void> {
  await run("DELETE FROM auth.sessions WHERE user_id = $1", [userId], OWNER);
}

/** Membuang sesi kedaluwarsa. Dipanggil cron; tidak wajib untuk kebenaran. */
export async function pruneExpiredSessions(): Promise<number> {
  const rows = await run<{ count: string }>(
    "WITH d AS (DELETE FROM auth.sessions WHERE expires_at <= now() RETURNING 1) SELECT count(*) FROM d",
    [],
    OWNER,
  );
  return Number(rows[0]?.count ?? 0);
}
