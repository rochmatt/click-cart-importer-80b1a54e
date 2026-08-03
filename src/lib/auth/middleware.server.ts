import { createMiddleware } from "@tanstack/react-start";
import { getSessionUser } from "./session.server";

// Middleware autentikasi. Identitas datang dari cookie sesi httpOnly.
//
// Saat cutover, kunci context ini sengaja masih bernama `supabase` supaya
// puluhan pemanggilan di berkas lain tidak perlu disentuh bersamaan dengan
// pergantian mesin autentikasi — dua hal yang gagal serentak sulit dibedakan
// penyebabnya. Setelah cutover terbukti stabil, namanya diganti menjadi `db`,
// yang jujur menyebut apa adanya: klien PostgreSQL lokal.
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
      db: createUserClient(user.id),
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
      db: createUserClient(user?.id ?? null),
      userId: user?.id ?? null,
      claims: user ? ({ sub: user.id, email: user.email } as Record<string, unknown>) : null,
    },
  });
});
