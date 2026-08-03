import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import {
  isCancellationStatus,
  isRefundStatus,
  orderUrl,
  refundEta,
  shouldNotify,
  statusCopy,
  templateForStatus,
  trackingUrl,
} from "@/lib/order-emails.server";

/**
 * Membandingkan rahasia hook tanpa membocorkan lewat waktu eksekusi.
 *
 * GAGAL TERTUTUP: kalau ORDER_HOOK_SECRET belum disetel, fungsi ini menolak
 * semua permintaan. Perbandingan biasa akan menyamakan dua nilai kosong dan
 * membuka endpoint ini ke internet begitu variabelnya lupa dipasang.
 *
 * Panjang yang berbeda dijawab lebih dulu karena timingSafeEqual melempar bila
 * panjang buffer tidak sama. Panjang rahasia bukan informasi yang berguna bagi
 * penyerang; isinya yang dilindungi.
 */
function hookSecretCocok(request: Request): boolean {
  const diharapkan = process.env.ORDER_HOOK_SECRET;
  if (!diharapkan) {
    console.error("ORDER_HOOK_SECRET belum disetel — hook status pesanan menolak semua permintaan");
    return false;
  }
  const diberikan =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.headers.get("x-hook-secret") ||
    "";
  const a = Buffer.from(diberikan);
  const b = Buffer.from(diharapkan);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Reliable status-change trigger: scans orders whose current status differs from
 * the last status we emailed about and sends one update per change.
 *
 * Dipanggil terjadwal — dulu oleh pg_cron milik Supabase, kini oleh cron server
 * ini sendiri. Aman dipanggil berulang: pengiriman didedup oleh notified_status
 * dan idempotency key, jadi jadwal yang rapat hanya memboroskan satu query.
 */
export const Route = createFileRoute("/api/public/hooks/order-status-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hookSecretCocok(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Klien PostgreSQL lokal yang melewati RLS, setara service_role dulu.
        const { createServiceClient } = await import("@/lib/db/client.server");
        const db = createServiceClient();
        const { data: rows, error } = await db
          .from("orders")
          .select(
            "id, order_number, status, notified_status, customer_email, shipping_name, courier, tracking_number, eta_date, destination_city, notify_status_updates, notify_level, total, payment_method, updated_at, last_update",
          )
          .neq("status", "")
          .order("updated_at", { ascending: false })
          .limit(100);

        if (error) {
          console.error("order-status-emails query failed", error);
          return Response.json({ error: "Query failed" }, { status: 500 });
        }

        let sent = 0;
        let skipped = 0;

        for (const row of rows ?? []) {
          if (row.status === row.notified_status) continue;
          if (!row.customer_email) continue;

          if (!shouldNotify(row.notify_level, row.notify_status_updates, row.status)) {
            await db.from("orders").update({ notified_status: row.status }).eq("id", row.id);
            skipped += 1;
            continue;
          }

          const copy = statusCopy(row.status);
          const templateName = templateForStatus(row.status);
          const shared = {
            customerName: row.shipping_name || undefined,
            orderNumber: row.order_number,
            headline: copy.headline,
            message: copy.message,
            orderUrl: orderUrl(row.order_number),
            supportUrl: trackingUrl(row.order_number),
          };

          let templateData: Record<string, unknown>;
          if (isCancellationStatus(row.status)) {
            templateData = {
              ...shared,
              reason: row.last_update || undefined,
              cancelledAt: row.updated_at
                ? new Date(row.updated_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : undefined,
              total: row.total ?? undefined,
              paymentMethod: row.payment_method || undefined,
              refundExpected: (row.total ?? 0) > 0 && row.payment_method !== "cod",
            };
          } else if (isRefundStatus(row.status)) {
            templateData = {
              ...shared,
              status: row.status,
              refundAmount: row.total ?? undefined,
              refundMethod: row.payment_method || undefined,
              refundEta:
                row.status === "refund_rejected"
                  ? undefined
                  : refundEta(row.payment_method || "cod"),
            };
          } else {
            templateData = {
              ...shared,
              status: row.status,
              courier: row.courier || undefined,
              trackingNumber: row.tracking_number || undefined,
              etaDate: row.eta_date || undefined,
              destinationCity: row.destination_city || undefined,
              trackingUrl: trackingUrl(row.order_number),
            };
          }

          try {
            await sendTemplateEmail(templateName, row.customer_email, {
              idempotencyKey: `order-status-${row.id}-${row.status}`,
              templateData,
            });
            sent += 1;
          } catch (err) {
            console.error("status email failed", row.order_number, err);
            continue; // leave notified_status untouched so the next run retries
          }

          await db.from("orders").update({ notified_status: row.status }).eq("id", row.id);
        }

        return Response.json({ ok: true, sent, skipped });
      },
    },
  },
});
