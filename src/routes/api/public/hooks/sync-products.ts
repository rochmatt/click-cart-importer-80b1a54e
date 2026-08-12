import { createFileRoute } from "@tanstack/react-router";
import { hookSecretMatches } from "@/lib/hook-auth.server";

/**
 * Pemicu sinkronisasi stok & harga produk marketplace.
 *
 * Dipanggil terjadwal oleh cron server (lihat /www/repo/sync-products-cron.sh).
 * Aman dipanggil berulang: tiap run membaca ulang sebatch produk yang paling
 * lama tak dicek dan hanya mengirim email bila ada perubahan. Otentikasi memakai
 * rahasia SYNC_HOOK_SECRET (Authorization: Bearer …), gagal-tertutup.
 *
 * Query opsional: ?limit=N (default 40, maksimum 200) — ukuran batch per run.
 */
export const Route = createFileRoute("/api/public/hooks/sync-products")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hookSecretMatches(request, "SYNC_HOOK_SECRET")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const limitParam = new URL(request.url).searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : undefined;

        try {
          const { runProductSyncDigest } = await import("@/lib/product-sync.server");
          const summary = await runProductSyncDigest({
            limit: Number.isFinite(limit) ? (limit as number) : undefined,
          });
          return Response.json({ ok: true, ...summary });
        } catch (error) {
          console.error("sync-products hook gagal", error);
          return Response.json({ error: "Sync failed" }, { status: 500 });
        }
      },
    },
  },
});
