// Integrasi Apify (Fase 3) — server-only. Token diatur admin & disimpan di
// store_settings (bukan .env). Apify menjalankan browser+proxy+anti-bot di
// cloud-nya, jadi server ini bisa membaca Shopee (yang memblokir fetch langsung
// kita: 403 + captcha) tanpa browser lokal. Tak pernah melempar.

import { run } from "@/lib/db/pool.server";
import { type Availability } from "@/lib/product-sync";

/** Token Apify tersimpan (diatur admin di Settings). "" bila belum diisi. */
export async function apifyToken(): Promise<string> {
  try {
    const rows = await run<{ apify_token: string }>(
      "SELECT apify_token FROM public.store_settings ORDER BY created_at ASC LIMIT 1",
      [],
      { rls: false },
    );
    return (rows[0]?.apify_token ?? "").trim();
  } catch (error) {
    console.error("apify: gagal baca token", error);
    return "";
  }
}

export async function isApifyConfigured(): Promise<boolean> {
  return (await apifyToken()).length > 0;
}

// Actor Shopee terpilih — mengembalikan harga IDR + stok + detail terparse.
const SHOPEE_ACTOR = "zen-studio~shopee-product-detail-scraper";

export interface ApifyShopeeItem {
  itemId?: number | string;
  shopId?: number | string;
  name?: string;
  url?: string;
  image?: string;
  images?: string[];
  price?: number;
  priceBeforeDiscount?: number;
  priceMin?: number;
  priceMax?: number;
  discountPercent?: number | null;
  currency?: string;
  stock?: number;
  sold?: number | null;
}

/**
 * Jalankan actor Shopee untuk daftar URL, kembalikan item terparse. [] bila token
 * belum diisi / gagal / diblokir → pemanggil fallback. Sinkron (menunggu actor
 * selesai ~30–90 dtk). Batasi jumlah URL agar tak lama & hemat kredit.
 */
export async function runShopeeByUrls(urls: string[]): Promise<ApifyShopeeItem[]> {
  const token = await apifyToken();
  const clean = urls.filter(Boolean);
  if (!token || clean.length === 0) return [];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 150000);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${SHOPEE_ACTOR}/run-sync-get-dataset-items`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ startUrls: clean.map((url) => ({ url })) }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      console.error("apify shopee actor gagal", res.status, (await res.text()).slice(0, 200));
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? (data as ApifyShopeeItem[]) : [];
  } catch (error) {
    console.error("apify shopee actor error", error);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Petakan item Apify → harga/stok untuk mesin sync. Harga sudah IDR bersih (bukan
 * ×100000). Konvensi sama dengan grabber: price = harga coret (lebih tinggi),
 * salePrice = harga sekarang.
 */
export function shopeeItemToOutcome(it: ApifyShopeeItem): {
  price: number | null;
  salePrice: number | null;
  availability: Availability;
} {
  const cur = n(it.price) ?? n(it.priceMin);
  const before = n(it.priceBeforeDiscount);
  const stock = n(it.stock);
  const availability: Availability = stock == null ? "unknown" : stock > 0 ? "in" : "out";
  if (before && before > 0 && cur != null && before > cur) {
    return { price: before, salePrice: cur, availability };
  }
  return { price: cur, salePrice: null, availability };
}
