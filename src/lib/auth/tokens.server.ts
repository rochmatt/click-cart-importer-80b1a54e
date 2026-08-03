// Token sekali-pakai untuk verifikasi email, reset password, dan ganti email.
//
// Seperti sesi, yang disimpan adalah SHA-256 token, bukan tokennya. Isi tabel
// auth.tokens yang bocor tidak bisa dipakai mengambil alih akun.
//
// Konsumsi bersifat ATOMIK lewat satu UPDATE ... WHERE consumed_at IS NULL
// RETURNING. Pola baca-lalu-tulis akan membuka balapan: dua permintaan yang tiba
// bersamaan sama-sama melihat token belum terpakai, dan tautan reset password
// jadi bisa dipakai dua kali.

import { createHash, randomBytes } from "node:crypto";
import { run } from "@/lib/db/pool.server";

const OWNER = { rls: false } as const;

export type TokenKind = "signup" | "recovery" | "email_change" | "magiclink" | "reauthentication";

/** Masa berlaku per jenis. Reset password paling singkat karena paling berbahaya. */
const TTL_SECONDS: Record<TokenKind, number> = {
  signup: 24 * 60 * 60,
  recovery: 60 * 60,
  email_change: 24 * 60 * 60,
  magiclink: 15 * 60,
  reauthentication: 10 * 60,
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64");
}

/**
 * Membuat token baru dan mengembalikan nilai MENTAH-nya untuk dikirim lewat
 * email. Nilai itu tidak pernah bisa dibaca lagi setelah fungsi ini selesai.
 */
export async function createToken(
  userId: string,
  kind: TokenKind,
  newEmail?: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  // Token lama yang belum terpakai untuk jenis yang sama dibatalkan. Tanpa ini,
  // meminta tautan reset berkali-kali meninggalkan beberapa tautan aktif
  // sekaligus, dan yang paling lama bocor tetap bisa dipakai.
  await run(
    "DELETE FROM auth.tokens WHERE user_id = $1 AND kind = $2 AND consumed_at IS NULL",
    [userId, kind],
    OWNER,
  );

  await run(
    `INSERT INTO auth.tokens (user_id, kind, token_hash, new_email, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [userId, kind, hashToken(token), newEmail ?? null, TTL_SECONDS[kind]],
    OWNER,
  );

  return token;
}

export interface ConsumedToken {
  userId: string;
  newEmail: string | null;
}

/**
 * Menandai token terpakai dan mengembalikan pemiliknya, atau null kalau token
 * tidak dikenal, sudah terpakai, kedaluwarsa, atau jenisnya tidak cocok.
 *
 * Jenis ikut dicocokkan supaya token verifikasi email tidak bisa dipakai
 * sebagai token reset password.
 */
export async function consumeToken(token: string, kind: TokenKind): Promise<ConsumedToken | null> {
  const rows = await run<{ user_id: string; new_email: string | null }>(
    `UPDATE auth.tokens
        SET consumed_at = now()
      WHERE token_hash = $1
        AND kind = $2
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING user_id, new_email`,
    [hashToken(token), kind],
    OWNER,
  );

  const row = rows[0];
  return row ? { userId: row.user_id, newEmail: row.new_email } : null;
}

/** Membuang token kedaluwarsa dan yang sudah terpakai. Dipanggil cron. */
export async function pruneTokens(): Promise<number> {
  const rows = await run<{ count: string }>(
    `WITH d AS (
       DELETE FROM auth.tokens
        WHERE expires_at <= now() OR consumed_at IS NOT NULL
       RETURNING 1
     ) SELECT count(*) FROM d`,
    [],
    OWNER,
  );
  return Number(rows[0]?.count ?? 0);
}
