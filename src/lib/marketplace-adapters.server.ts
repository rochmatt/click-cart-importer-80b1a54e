// Adapter baca harga/stok marketplace (Fase 2–3) — server-only.
//
// readViaAdapter(url): coba baca harga/stok. null = tak bisa → PEMANGGIL fallback
// ke grabber HTML lama.
//
// SHOPEE (Fase 3): coba Apify dulu — cloud Apify menembus anti-bot yang memblokir
// fetch langsung server ini (terbukti 403 + captcha). Kalau token Apify belum
// diisi/gagal, jatuh ke API internal langsung (readShopee, sering 403) → null.
// Tokopedia (GraphQL) & TikTok (butuh headless) BELUM di-fetch — parser
// mengenalinya tapi adapter kembalikan null.

import { type Availability } from "./product-sync";
import { parseMarketplaceUrl, isShortLink } from "./marketplace-url";
import { runShopeeByUrls, shopeeItemToOutcome } from "./apify.server";

const DESKTOP_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
];
function ua(): string {
  return DESKTOP_UAS[Math.floor(Math.random() * DESKTOP_UAS.length)];
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

async function getJson(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 12000,
): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) return null; // 403 anti-bot dsb → fallback
    if (!/json/i.test(res.headers.get("content-type") ?? "")) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SHOPEE_SCALE = 100000; // API internal Shopee: harga = integer ×100000

type AdapterOut = { price: number | null; salePrice: number | null; availability: Availability };

function sumStock(models: unknown): number | null {
  if (!Array.isArray(models)) return null;
  let sum = 0;
  let seen = false;
  for (const m of models) {
    const rec = m as Record<string, unknown>;
    const s = num(rec?.normal_stock) ?? num(rec?.stock);
    if (s != null) {
      sum += s;
      seen = true;
    }
  }
  return seen ? sum : null;
}

// Fallback: API internal Shopee langsung (dari server) — sering 403 anti-bot.
async function readShopeeDirect(
  shopId: string,
  itemId: string,
  domain: string,
): Promise<AdapterOut | null> {
  const dom = /^shopee\./i.test(domain) ? domain : "shopee.co.id";
  const headers: Record<string, string> = {
    "user-agent": ua(),
    accept: "application/json",
    referer: `https://${dom}/product-i.${shopId}.${itemId}`,
    "x-api-source": "pc",
    "x-requested-with": "XMLHttpRequest",
    "accept-language": "id-ID,id;q=0.9,en;q=0.8",
  };
  const urls = [
    `https://${dom}/api/v4/pdp/get_pc?shop_id=${shopId}&item_id=${itemId}`,
    `https://${dom}/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`,
  ];
  for (const u of urls) {
    const j = await getJson(u, headers);
    if (!j || j.error) continue; // {error:...} = diblokir/not-found, BUKAN OOS
    const data = j.data as Record<string, unknown> | undefined;
    const item = (data?.item as Record<string, unknown> | undefined) ?? data;
    if (!item || typeof item !== "object") continue;
    const cur = num(item.price);
    if (cur == null) continue;
    const beforeRaw = num(item.price_before_discount);
    const price = Math.round(cur / SHOPEE_SCALE);
    const original = beforeRaw && beforeRaw > cur ? Math.round(beforeRaw / SHOPEE_SCALE) : null;
    const stock = num(item.stock) ?? sumStock(item.models);
    const status = String(item.status ?? item.item_status ?? "").toLowerCase();
    const inStatus = status === "" || status === "normal";
    const availability: Availability = !inStatus ? "out" : stock === 0 ? "out" : "in";
    return original
      ? { price: original, salePrice: price, availability }
      : { price, salePrice: null, availability };
  }
  return null;
}

export async function readViaAdapter(url: string): Promise<AdapterOut | null> {
  if (isShortLink(url)) return null; // biar grabber yang ikuti redirect
  const parsed = parseMarketplaceUrl(url);
  if (!parsed) return null;
  try {
    if (parsed.marketplace === "shopee") {
      // Apify dulu (menembus anti-bot). Kalau kosong (token belum diisi / gagal),
      // coba API internal langsung (sering 403) → null → grabber HTML.
      const items = await runShopeeByUrls([url]);
      if (items.length) return shopeeItemToOutcome(items[0]);
      return await readShopeeDirect(parsed.shopId, parsed.itemId, parsed.domain);
    }
    // tokopedia (GraphQL) & tiktok (headless) → fallback untuk sekarang
    return null;
  } catch {
    return null;
  }
}
