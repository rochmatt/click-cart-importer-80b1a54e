// Mesin sinkronisasi produk — Fase 1 + penjadwalan bertingkat & sinkron-satuan (Fase 2).
//
// Alur: ambil sebatch produk marketplace yang JATUH TEMPO (per tier) → baca ulang
// halaman sumbernya pakai grabber yang sama dengan fitur "Grab dari URL" →
// putuskan perubahan (product-sync.ts, murni & teruji) → tulis product_sync_state,
// dan HANYA saat stok berubah, ubah admin_products.status → kirim satu email
// ringkasan bila ada perubahan.
//
// Sengaja SEKUENSIAL dengan jeda sopan: batch kecil per run, dipanggil berkala
// oleh cron, merotasi katalog. Konkurensi + proxy + adapter internal-API adalah
// urusan Fase 2 lanjutan.

import { run } from "@/lib/db/pool.server";
import { grabProductFromUrl } from "@/lib/product-grab.server";
import { readViaAdapter } from "@/lib/marketplace-adapters.server";
import { decideProductSync, TIER_HOURS, type GrabOutcome } from "@/lib/product-sync";
import { emailFrom, isEmailConfigured, sendEmail } from "@/lib/email/resend.server";
import { isTelegramConfigured, sendTelegram } from "@/lib/telegram.server";

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
  price: number | null;
  sale_price: number | null;
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
    // Adapter internal-API dulu (stok akurat bila lolos anti-bot); kalau null
    // (blokir/short-link/belum didukung), fallback ke grabber HTML lama.
    const via = await readViaAdapter(url);
    if (via) {
      return {
        ok: true,
        price: via.price,
        salePrice: via.salePrice,
        availability: via.availability,
      };
    }
    const g = await grabProductFromUrl(url);
    return { ok: true, price: g.price, salePrice: g.salePrice, availability: g.availability };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Kolom kandidat yang dibaca kedua jalur (batch & satuan) — dijaga sama persis.
const CANDIDATE_COLS = `p.id, p.title, p.status AS admin_status, p.links,
            p.price, p.sale_price,
            s.status AS sync_status, s.source_hash, s.source_price,
            s.fail_count, s.previous_status`;

/**
 * Membaca ulang & menuliskan SATU produk. Mengembalikan event (bila ada) + status
 * sync baru. Tidak melempar: kegagalan tulis dicatat dan dianggap "tak terproses".
 * Dipakai bersama oleh batch dan tombol "Sinkron sekarang" di dashboard.
 */
async function syncProductRow(
  row: CandidateRow,
): Promise<{ processed: boolean; event: SyncEventRow | null; syncStatus: string | null }> {
  const source = pickSource(row.links);
  if (!source) return { processed: false, event: null, syncStatus: null };

  const grab = await bacaSumber(source.url);
  const decision = decideProductSync(
    {
      adminStatus: row.admin_status,
      syncStatus: row.sync_status ?? "idle",
      sourceHash: row.source_hash,
      sourcePrice: row.source_price,
      failCount: row.fail_count ?? 0,
      previousStatus: row.previous_status,
      sellingPrice: row.sale_price ?? row.price,
    },
    grab,
  );

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
    return { processed: false, event: null, syncStatus: null };
  }

  const event: SyncEventRow | null = decision.event
    ? {
        productId: row.id,
        title: row.title || "(tanpa judul)",
        marketplace: source.marketplace,
        url: source.url,
        type: decision.event.type,
        detail: decision.event.detail,
      }
    : null;
  return { processed: true, event, syncStatus: decision.syncStatus };
}

/**
 * Membaca ulang sebatch produk yang JATUH TEMPO dan menuliskan perubahannya.
 * Penjadwalan bertingkat: tiap produk punya interval cek sendiri (TIER_HOURS),
 * jadi yang laris/bermasalah dicek lebih sering dan draft/ekor-panjang lebih
 * jarang — CASE di SQL mencerminkan tierHoursFor() di product-sync.ts.
 */
export async function syncAllProducts(opts: { limit?: number } = {}): Promise<SyncSummary> {
  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  const candidates = await run<CandidateRow>(
    `SELECT ${CANDIDATE_COLS}
       FROM public.admin_products p
       LEFT JOIN public.product_sync_state s ON s.product_id = p.id
      WHERE (COALESCE(p.links->>'shopee', '') <> ''
          OR COALESCE(p.links->>'tokopedia', '') <> ''
          OR COALESCE(p.links->>'tiktok', '') <> '')
        AND (
          s.last_checked_at IS NULL
          OR s.last_checked_at < now() - (
              CASE
                WHEN s.status = 'error' THEN $2::int
                WHEN s.status = 'out_of_stock' THEN $3::int
                WHEN p.status = 'active' THEN $4::int
                ELSE $5::int
              END * interval '1 hour')
        )
      ORDER BY s.last_checked_at ASC NULLS FIRST
      LIMIT $1`,
    [limit, TIER_HOURS.error, TIER_HOURS.outOfStock, TIER_HOURS.active, TIER_HOURS.other],
    { rls: false },
  );

  const events: SyncEventRow[] = [];
  let checked = 0;

  for (let i = 0; i < candidates.length; i++) {
    if (i > 0) await sleep(JEDA_MIN_MS + Math.floor(Math.random() * JEDA_JITTER_MS));
    const { processed, event } = await syncProductRow(candidates[i]);
    if (processed) checked++;
    if (event) events.push(event);
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

/**
 * Sinkron satu produk atas permintaan (tombol "Sinkron sekarang" di dashboard).
 * Tidak menghormati tier/jatuh-tempo — admin memang minta cek sekarang.
 */
export async function syncProductById(
  id: string,
): Promise<{ synced: boolean; event: SyncEventRow | null; syncStatus: string | null }> {
  const rows = await run<CandidateRow>(
    `SELECT ${CANDIDATE_COLS}
       FROM public.admin_products p
       LEFT JOIN public.product_sync_state s ON s.product_id = p.id
      WHERE p.id = $1
      LIMIT 1`,
    [id],
    { rls: false },
  );
  if (!rows.length) return { synced: false, event: null, syncStatus: null };
  const { processed, event, syncStatus } = await syncProductRow(rows[0]);
  return { synced: processed, event, syncStatus };
}

// --- Ringkasan email -------------------------------------------------------

const GRUP: { types: string[]; judul: string }[] = [
  { types: ["margin_loss"], judul: "🔻 RUGI — disembunyikan (modal ≥ harga jual)" },
  { types: ["out_of_stock"], judul: "🔴 Stok habis (disembunyikan otomatis)" },
  { types: ["margin_thin"], judul: "⚠️ Margin tipis (masih untung, cek harga)" },
  { types: ["back_in_stock"], judul: "🟢 Tersedia lagi (ditampilkan kembali)" },
  { types: ["margin_ok"], judul: "🟢 Margin sehat lagi (ditampilkan kembali)" },
  { types: ["price_up", "price_down"], judul: "💰 Harga modal berubah" },
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
): Promise<SyncSummary & { emailed: boolean; telegramed: boolean }> {
  const summary = await syncAllProducts(opts);
  let emailed = false;
  let telegramed = false;

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

  // Telegram: alert singkat hanya untuk yang mendesak (habis/pulih/gagal).
  // Config-gated — no-op sampai TELEGRAM_BOT_TOKEN/CHAT_ID diisi.
  if (summary.changes > 0 && isTelegramConfigured()) {
    const urgent = summary.events.filter((e) =>
      ["out_of_stock", "back_in_stock", "margin_loss", "margin_ok", "error"].includes(e.type),
    );
    if (urgent.length) {
      const lines = urgent.slice(0, 20).map((e) => `• ${e.title} — ${e.detail}`);
      telegramed = await sendTelegram(
        `[PasarPilih] Sinkron produk: ${summary.changes} perubahan\n${lines.join("\n")}`,
      );
    }
  }

  return { ...summary, emailed, telegramed };
}
