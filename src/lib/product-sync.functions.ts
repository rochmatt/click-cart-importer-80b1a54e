import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware.server";
import { assertAdmin } from "@/lib/admin-access.server";

// Server functions untuk Dashboard Pengecualian sinkronisasi produk (Fase 2).
// Semua di-gate assertAdmin. Bacaan pakai pool service (run) SETELAH assertAdmin,
// pola yang sama dengan getStoreSettings dkk di admin.functions.ts.

export interface ProductSyncRow {
  id: string;
  title: string;
  image: string | null;
  admin_status: string; // active | draft | out_of_stock
  marketplace: string | null; // shopee | tokopedia | tiktok
  source_url: string | null;
  sync_status: string; // idle | ok | out_of_stock | error
  source_price: number | null;
  fail_count: number;
  last_error: string | null;
  last_checked_at: string | null; // ISO
}

/** Semua produk ber-link marketplace + status sinkronnya; yang butuh perhatian dulu. */
export const listProductSync = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ProductSyncRow[]> => {
    await assertAdmin(context.db, context.userId);
    const { run } = await import("@/lib/db/pool.server");
    return await run<ProductSyncRow>(
      `SELECT p.id, p.title, (p.images)[1] AS image, p.status AS admin_status,
              s.marketplace, s.source_url, COALESCE(s.status, 'idle') AS sync_status,
              s.source_price, COALESCE(s.fail_count, 0) AS fail_count,
              s.last_error, s.last_checked_at
         FROM public.admin_products p
         LEFT JOIN public.product_sync_state s ON s.product_id = p.id
        WHERE COALESCE(p.links->>'shopee', '') <> ''
           OR COALESCE(p.links->>'tokopedia', '') <> ''
           OR COALESCE(p.links->>'tiktok', '') <> ''
        ORDER BY (COALESCE(s.status, 'idle') IN ('error', 'out_of_stock')) DESC,
                 s.last_checked_at DESC NULLS LAST
        LIMIT 500`,
      [],
      { rls: false },
    );
  });

/** Sinkron satu produk sekarang (abaikan tier). */
export const syncProductNow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const { syncProductById } = await import("@/lib/product-sync.server");
    return await syncProductById(data.id);
  });

/** Jalankan satu batch sinkron (produk yang jatuh tempo) sekarang. */
export const runSyncBatch = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const { syncAllProducts } = await import("@/lib/product-sync.server");
    return await syncAllProducts({ limit: data.limit ?? 40 });
  });
