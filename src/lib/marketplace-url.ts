// Parser URL produk marketplace (Fase 2) — MURNI & teruji (marketplace-url.test.ts).
// Regex dari riset spec; format URL ini stabil bertahun-tahun (confidence tinggi).
// Ekstraksi ID ini yang dipakai adapter untuk membaca stok/harga; fetch-nya
// (rapuh, anti-bot) ada di marketplace-adapters.server.ts.

export type MarketplaceId = "shopee" | "tokopedia" | "tiktok";

export type ParsedUrl =
  | { marketplace: "shopee"; shopId: string; itemId: string; domain: string }
  | { marketplace: "tokopedia"; shopDomain: string; slug: string }
  | { marketplace: "tiktok"; productId: string }
  | null;

// Shopee canonical: ".../-i.{shopId}.{itemId}" ATAU "/product/{shopId}/{itemId}".
// Urutan SELALU shopId dulu, itemId kemudian.
const SHOPEE_RE = /(?:-i\.|\/product\/)(\d+)[./](\d+)(?=[/?#]|$)/;
// Short/share link Shopee TIDAK memuat ID — harus di-resolve dulu.
const SHOPEE_SHORT = /^https?:\/\/(?:shope\.ee|s\.shopee\.[a-z.]+)\//i;

// Tokopedia: tokopedia.com/{shopDomain}/{slug}, kecuali path sistem (negative lookahead).
const TOKO_RE =
  /^https?:\/\/(?:www\.)?tokopedia\.com\/(?!(?:www|m|discovery|search|find|help|p|promo|about|rewards|deals|official-store|category|blog|mall|bantuan|login|register|keranjang|wishlist|feed|play|now|nyicil|gopaylater|s|hot|ta|contact-us)\b)([a-zA-Z0-9][a-zA-Z0-9._-]*)\/([^/?#]+)/i;
const TOKO_SHORT = /^https?:\/\/vt\.tokopedia\.com\/t\//i;

// TikTok Shop: /view/product/{id}, /pdp/.../{id}, atau ?product_id={id}.
const TIKTOK_RE =
  /\/view\/product\/(\d{15,25})|\/pdp\/[^/?#]+\/(\d{15,25})|[?&]product_id=(\d{15,25})/;
const TIKTOK_SHORT = /^https?:\/\/(?:vt|vm)\.tiktok\.com\//i;

function hostTld(url: string): string {
  const m = url.match(/^https?:\/\/([^/?#]+)/i);
  return m ? m[1].toLowerCase() : "";
}

/** Mengurai URL produk marketplace ke ID-nya. null bila bukan URL produk kanonik. */
export function parseMarketplaceUrl(raw: string): ParsedUrl {
  const url = (raw || "").trim();
  if (!url) return null;

  if (/(^|\.)shopee\./i.test(hostTld(url))) {
    const m = url.match(SHOPEE_RE);
    if (m) return { marketplace: "shopee", shopId: m[1], itemId: m[2], domain: hostTld(url) };
    return null;
  }

  const tk = url.match(TOKO_RE);
  if (tk) return { marketplace: "tokopedia", shopDomain: tk[1], slug: tk[2] };

  if (/tiktok/i.test(hostTld(url))) {
    const tt = url.match(TIKTOK_RE);
    const pid = tt && (tt[1] || tt[2] || tt[3]);
    if (pid) return { marketplace: "tiktok", productId: pid };
  }

  return null;
}

/**
 * Short-link yang tak memuat ID (shope.ee, vt.tokopedia, vt/vm.tiktok). Sync
 * membiarkan grabber lama yang mengikuti redirect-nya — adapter internal-API
 * butuh ID langsung, jadi ini di-skip adapter.
 */
export function isShortLink(raw: string): boolean {
  const url = (raw || "").trim();
  return SHOPEE_SHORT.test(url) || TOKO_SHORT.test(url) || TIKTOK_SHORT.test(url);
}
