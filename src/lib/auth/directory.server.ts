// Pembacaan daftar pengguna untuk panel admin.
//
// Menggantikan supabaseAdmin.auth.admin.listUsers(). Setelah cutover, pengguna
// tinggal di auth.users lokal dan API admin Supabase mengembalikan kosong —
// panel pelanggan dan panel staf akan tampak kehilangan seluruh emailnya tanpa
// error apa pun.
//
// Nama tampilan diambil dari public.profiles, bukan dari metadata pengguna:
// sistem auth ini tidak menyimpan metadata bebas, dan profil sudah menjadi
// tempat kanonik untuk data yang bisa diubah pemiliknya.

import { run } from "@/lib/db/pool.server";

const OWNER = { rls: false } as const;

export interface DirektoriUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export async function listUsers(limit = 200): Promise<DirektoriUser[]> {
  return run<DirektoriUser>(
    `SELECT u.id,
            u.email,
            coalesce(p.display_name, '') AS "displayName",
            u.created_at                 AS "createdAt"
       FROM auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
      ORDER BY u.created_at DESC
      LIMIT $1`,
    [limit],
    OWNER,
  );
}

/**
 * Mencari pengguna lewat id.
 *
 * Dipakai audit log saat mencabut peran: emailnya harus diambil SEBELUM
 * pencabutan, karena catatan yang hanya memuat uuid menuntut query tambahan
 * untuk tahu siapa orangnya — persis saat orang membaca audit log.
 */
export async function findUserById(id: string): Promise<DirektoriUser | null> {
  const rows = await run<DirektoriUser>(
    `SELECT u.id,
            u.email,
            coalesce(p.display_name, '') AS "displayName",
            u.created_at                 AS "createdAt"
       FROM auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id = $1`,
    [id],
    OWNER,
  );
  return rows[0] ?? null;
}

/** Pencocokan email tidak membedakan kapitalisasi, sama seperti saat login. */
export async function findUserByEmail(email: string): Promise<DirektoriUser | null> {
  const rows = await run<DirektoriUser>(
    `SELECT u.id,
            u.email,
            coalesce(p.display_name, '') AS "displayName",
            u.created_at                 AS "createdAt"
       FROM auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
      WHERE lower(u.email) = lower($1)`,
    [email.trim()],
    OWNER,
  );
  return rows[0] ?? null;
}
