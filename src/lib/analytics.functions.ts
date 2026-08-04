import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware.server";
import { assertAdmin } from "@/lib/admin-access.server";
import { batasi } from "@/lib/auth/rate-limit.server";

// Analytics view produk, swakelola.
//
// Tidak ada gtag/plausible/skrip pihak ketiga: aplikasi ini self-hosted dan
// datanya tinggal di server sendiri, jadi analytics-nya pun. Yang dicatat hanya
// "produk X dilihat" — tanpa siapa yang melihat. Lihat db/008-product-views.sql.

const refSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  // Membatasi ke bentuk id produk yang sah menutup pemakaian tabel ini sebagai
  // tempat menaruh teks sembarang lewat endpoint publik.
  .regex(/^[A-Za-z0-9:_-]+$/, "id produk tidak valid");

/**
 * Mencatat satu view produk. Publik — dipanggil dari halaman detail produk.
 *
 * TIDAK PERNAH MELEMPAR KE PEMANGGIL. Ini analytics; kegagalannya tidak boleh
 * mengganggu halaman yang sedang dilihat. Nilai kembaliannya diabaikan klien.
 *
 * DIBATASI PER IP + PRODUK. Endpoint publik yang menambah penghitung mengundang
 * penggelembungan — memuat ulang halaman berkali-kali, atau menembaknya dari
 * skrip. Batas satu hitungan per produk per IP dalam 10 menit membuat angkanya
 * mendekati "pengunjung unik yang tertarik", bukan "jumlah refresh". Pembatasnya
 * di memori dan hilang saat restart; itu cukup, karena yang dijaga hanya
 * kualitas metrik lunak, bukan keamanan.
 */
export const recordProductView = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ productRef: refSchema }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    try {
      const ip = getRequest()?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "tanpa-ip";
      const { diizinkan } = batasi(`view:${ip}:${data.productRef}`, 1, 10 * 60);
      if (!diizinkan) return { ok: true };

      const { run } = await import("@/lib/db/pool.server");
      await run("SELECT public.catat_view_produk($1)", [data.productRef], { rls: false });
    } catch (error) {
      console.error("gagal mencatat view produk", error);
    }
    return { ok: true };
  });

export interface ProdukDilihat {
  product_ref: string;
  views: number;
}

const rangeSchema = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]) });

/**
 * Produk paling dilihat pada rentang tanggal terakhir, untuk dashboard admin.
 *
 * Dibatasi 10 teratas: readout ini menjawab "apa yang menarik minat pengunjung",
 * dan sepuluh sudah cukup untuk itu. Daftar lengkap hanya menambah kebisingan.
 */
export const adminTopViewedProducts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProdukDilihat[]> => {
    await assertAdmin(context.db, context.userId);
    const { run } = await import("@/lib/db/pool.server");
    const rows = await run<ProdukDilihat>(
      `SELECT product_ref, SUM(views)::int AS views
         FROM public.product_view_stats
        WHERE view_date >= (now() AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1)
        GROUP BY product_ref
        ORDER BY views DESC
        LIMIT 10`,
      [data.days],
      { rls: false },
    );
    return rows;
  });
