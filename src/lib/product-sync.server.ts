// Mesin sinkronisasi produk — Fase 1 (server-only).
//
// Alur: ambil sebatch produk marketplace (yang paling lama tak dicek dulu) →
// baca ulang halaman sumbernya pakai grabber yang sama dengan fitur "Grab dari
// URL" → putuskan perubahan (product-sync.ts, murni & teruji) → tulis
// product_sync_state, dan HANYA saat stok berubah, ubah admin_products.status →
// kirim satu email ringkasan bila ada perubahan.
//
// Sengaja SEKUENSIAL dengan jeda sopan: batch kecil per run, dipanggil berkala
// oleh cron, merotasi seluruh katalog. Konkurensi + proxy adalah urusan Fase 2.

import { run } from "@/lib/db/pool.server";
import { grabProductFromUrl } from "@/lib/product-grab.server";
import { decideProductSync, type GrabOutcome } from "@/lib/product-sync";
import { emailFrom, isEmailConfigured, sendEmail } from "@/lib/email/resend.server";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;
const JEDA_MIN_MS = 600;
const JEDA_JITTER_MS = 500;

type Marketplace = "shopee" | "tokopedia" | "tiktok";
const URUTAN_SUMBER: Marketplace[] = ["shopee", "tokopedia", "tiktok"];

interface CandidateRow {
  id: string;
  title: string;
  admin_status: string;
  links: Partial<Record<Marketplace, string>> | null;
  sync_status: string | null;
  source_hash: string | null;
  source_price: number | null;
  fail_count: number | null;
  previous_status: string | null;
}

export interface SyncEventRow {
  productId: string;
  title: string;
  marketplace: Marketplace;
  url: string;
  type: string;
  detail: string;
}

export interface SyncSummary {
  checked: number;
  changes: number;
  outOfStock: number;
  backInStock: number;
  priceChanges: number;
  errors: number;
  events: SyncEventRow[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickSource(
  links: CandidateRow["links"],
): { url: string; marketplace: Marketplace } | null {
  for (const mp of URUTAN_SUMBER) {
    const url = (links?.[mp] ?? "").trim();
    if (url) return { url, marketplace: mp };
  }
  return null;
}

async function bacaSumber(url: string): Promise<GrabOutcome> {
  try {
    const g = await grabProductFromUrl(url);
    return { ok: true, price: g.price, salePrice: g.salePrice, availability: g.availability };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Membaca ulang sebatch produk dan menuliskan perubahannya. Mengembalikan daftar
 * event untuk ringkasan email. Tidak melempar untuk kegagalan per-produk — satu
 * produk yang bermasalah tidak boleh menggagalkan seluruh batch.
 */
export async function syncAllProducts(opts: { limit?: number } = {}): Promise<SyncSummary> {
  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  const candidates = await run<CandidateRow>(
    `SELECT p.id, p.title, p.status AS admin_status, p.links,
            s.status AS sync_status, s.source_hash, s.source_price,
            s.fail_count, s.previous_status
       FROM public.admin_products p
       LEFT JOIN public.product_sync_state s ON s.product_id = p.id
      WHERE COALESCE(p.links->>'shopee', '') <> ''
         OR COALESCE(p.links->>'tokopedia', '') <> ''
         OR COALESCE(p.links->>'tiktok', '') <> ''
      ORDER BY s.last_checked_at ASC NULLS FIRST
      LIMIT $1`,
    [limit],
    { rls: false },
  );

  const events: SyncEventRow[] = [];
  let checked = 0;

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const source = pickSource(row.links);
    if (!source) continue;

    if (i > 0) await sleep(JEDA_MIN_MS + Math.floor(Math.random() * JEDA_JITTER_MS));

    const grab = await bacaSumber(source.url);
    const decision = decideProductSync(
      {
        adminStatus: row.admin_status,
        syncStatus: row.sync_status ?? "idle",
        sourceHash: row.source_hash,
        sourcePrice: row.source_price,
        failCount: row.fail_count ?? 0,
        previousStatus: row.previous_status,
      },
      grab,
    );
    checked++;

    try {
      await run(
        `INSERT INTO public.product_sync_state
           (product_id, marketplace, source_url, status, source_price, source_hash,
            fail_count, previous_status, last_error, last_checked_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
         ON CONFLICT (product_id) DO UPDATE SET
           marketplace = EXCLUDED.marketplace,
           source_url = EXCLUDED.source_url,
           status = EXCLUDED.status,
           source_price = EXCLUDED.source_price,
           source_hash = EXCLUDED.source_hash,
           fail_count = EXCLUDED.fail_count,
           previous_status = EXCLUDED.previous_status,
           last_error = EXCLUDED.last_error,
           last_checked_at = now(),
           updated_at = now()`,
        [
          row.id,
          source.marketplace,
          source.url,
          decision.syncStatus,
          decision.sourcePrice,
          decision.sourceHash,
          decision.failCount,
          decision.previousStatus,
          decision.lastError,
        ],
        { rls: false },
      );

      // Hanya perubahan stok yang menyentuh admin_products (dan memicu trigger
      // updated_at). Bookkeeping lain tetap di product_sync_state.
      if (decision.adminStatus) {
        await run(
          `UPDATE public.admin_products SET status = $1 WHERE id = $2`,
          [decision.adminStatus, row.id],
          { rls: false },
        );
      }
    } catch (error) {
      console.error("sinkronisasi: gagal tulis state", row.id, error);
      continue;
    }

    if (decision.event) {
      events.push({
        productId: row.id,
        title: row.title || "(tanpa judul)",
        marketplace: source.marketplace,
        url: source.url,
        type: decision.event.type,
        detail: decision.event.detail,
      });
    }
  }

  return {
    checked,
    changes: events.length,
    outOfStock: events.filter((e) => e.type === "out_of_stock").length,
    backInStock: events.filter((e) => e.type === "back_in_stock").length,
    priceChanges: events.filter((e) => e.type === "price_up" || e.type === "price_down").length,
    errors: events.filter((e) => e.type === "error").length,
    events,
  };
}

// --- Ringkasan email -------------------------------------------------------

const GRUP: { types: string[]; judul: string }[] = [
  { types: ["out_of_stock"], judul: "🔴 Stok habis (disembunyikan otomatis)" },
  { types: ["back_in_stock"], judul: "🟢 Tersedia lagi (ditampilkan kembali)" },
  { types: ["price_up", "price_down"], judul: "💰 Harga sumber berubah" },
  { types: ["error"], judul: "⚠️ Gagal sinkron (perlu dicek manual)" },
  { types: ["recovered"], judul: "↩️ Pulih (sumber bisa dibaca lagi)" },
];

function adminUrl(productId: string): string {
  const base = (process.env.SITE_URL || "").replace(/\/$/, "");
  return `${base}/admin/products/${productId}`;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

export function buildDigest(
  summary: SyncSummary,
): { subject: string; html: string; text: string } | null {
  if (summary.events.length === 0) return null;

  const subject =
    `[PasarPilih] Sinkron produk — ${summary.changes} perubahan` +
    (summary.errors ? `, ${summary.errors} error` : "");

  const htmlParts: string[] = [];
  const textParts: string[] = [];

  for (const grup of GRUP) {
    const items = summary.events.filter((e) => grup.types.includes(e.type));
    if (!items.length) continue;
    htmlParts.push(
      `<h3 style="margin:20px 0 8px;font-size:15px">${grup.judul}</h3><ul style="margin:0;padding-left:18px">`,
    );
    textParts.push(`\n${grup.judul}`);
    for (const it of items) {
      htmlParts.push(
        `<li style="margin:4px 0"><a href="${esc(adminUrl(it.productId))}" style="color:#0891b2;text-decoration:none">${esc(it.title)}</a>` +
          ` — <span style="color:#64748b">${esc(it.marketplace)} · ${esc(it.detail)}</span></li>`,
      );
      textParts.push(
        `  • ${it.title} — ${it.marketplace} · ${it.detail}\n    ${adminUrl(it.productId)}`,
      );
    }
    htmlParts.push(`</ul>`);
  }

  const ringkas = `${summary.checked} produk dicek · ${summary.changes} perubahan`;
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <h2 style="font-size:18px;margin:0 0 4px">Ringkasan sinkronisasi produk</h2>
    <p style="color:#64748b;margin:0 0 8px">${ringkas}</p>
    ${htmlParts.join("\n")}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Email otomatis dari mesin sinkronisasi PasarPilih. Balas ke ${esc(emailFrom())} bila perlu.</p>
  </div>`;
  const text = `Ringkasan sinkronisasi produk\n${ringkas}\n${textParts.join("\n")}\n`;

  return { subject, html, text };
}

async function adminRecipients(): Promise<string[]> {
  const fromEnv = (process.env.SYNC_DIGEST_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  try {
    const rows = await run<{ email: string }>(
      `SELECT u.email
         FROM auth.users u
         JOIN public.user_roles r ON r.user_id = u.id
        WHERE r.role = 'admin' AND u.email IS NOT NULL AND u.email <> ''`,
      [],
      { rls: false },
    );
    return Array.from(new Set(rows.map((r) => r.email)));
  } catch (error) {
    console.error("sinkronisasi: gagal ambil email admin", error);
    return [];
  }
}

/** Menjalankan sinkronisasi lalu mengirim satu email ringkasan bila ada perubahan. */
export async function runProductSyncDigest(
  opts: { limit?: number } = {},
): Promise<SyncSummary & { emailed: boolean }> {
  const summary = await syncAllProducts(opts);
  let emailed = false;

  const digest = buildDigest(summary);
  if (digest && isEmailConfigured()) {
    const to = await adminRecipients();
    if (to.length) {
      try {
        await sendEmail({
          to,
          subject: digest.subject,
          html: digest.html,
          text: digest.text,
          kind: "sinkronisasi",
        });
        emailed = true;
      } catch (error) {
        console.error("sinkronisasi: gagal kirim ringkasan", error);
      }
    }
  }

  return { ...summary, emailed };
}
