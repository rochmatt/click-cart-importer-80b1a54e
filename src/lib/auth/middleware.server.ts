import { createMiddleware } from "@tanstack/react-start";
import { getSessionUser } from "./session.server";

// Pengganti requireSupabaseAuth. Identitas datang dari cookie sesi, bukan JWT.
//
// BENTUK CONTEXT-NYA SENGAJA DIPERTAHANKAN: { supabase, userId, claims }. Enam
// berkas server function membacanya, dan `supabase` di sini adalah klien
// kompatibel yang menghadap PostgreSQL lokal — bukan Supabase. Namanya
// dipertahankan supaya delapan pemanggilan context.supabase.from() dan
// assertAdmin() tidak perlu disentuh sama sekali saat cutover.
//
// Nama itu memang menyesatkan setelah cutover. Mengganti namanya menjadi
// sesuatu seperti `db` lebih jujur, tapi itu menyebar perubahan ke enam berkas
// pada saat yang sama dengan pergantian autentikasi — dua hal yang gagal
// bersamaan jadi sulit dibedakan. Penggantian nama dilakukan terpisah setelah
// cutover terbukti stabil.
//
// TIDAK ADA middleware klien pendamping. attachSupabaseAuth dulu melampirkan
// header Authorization pada setiap pemanggilan; cookie httpOnly terkirim
// sendiri oleh browser, jadi tidak ada yang perlu dilampirkan — dan itulah
// sebabnya perlindungan CSRF di start.ts menjadi wajib, bukan opsional.

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Menolak permintaan tanpa sesi yang sah. */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();

  const { createUserClient } = await import("@/lib/db/client.server");

  return next({
    context: {
      supabase: createUserClient(user.id),
      userId: user.id,
      claims: { sub: user.id, email: user.email } as Record<string, unknown>,
    },
  });
});

/**
 * Varian yang membolehkan pengunjung anonim.
 *
 * userId null berarti tamu, dan klien yang diberikan TETAP tunduk RLS — bukan
 * klien service. Tanpa itu, satu pemanggilan yang lupa memeriksa userId akan
 * membuka seluruh tabel.
 */
export const optionalAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await getSessionUser();
  const { createUserClient } = await import("@/lib/db/client.server");

  return next({
    context: {
      supabase: createUserClient(user?.id ?? null),
      userId: user?.id ?? null,
      claims: user ? ({ sub: user.id, email: user.email } as Record<string, unknown>) : null,
    },
  });
});
