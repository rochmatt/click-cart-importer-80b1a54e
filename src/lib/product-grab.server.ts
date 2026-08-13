/**
 * Server-only scraper that turns a product page URL into structured fields.
 * Strategy: JSON-LD (schema.org/Product) → OpenGraph/meta → AI fallback.
 */

import { normalizePrices, parsePriceValue, type PriceIssue } from "./price-normalize";
import { normalizeAvailability, type Availability } from "./product-sync";
import { runShopeeByUrls, shopeeItemToOutcome, isApifyConfigured } from "@/lib/apify.server";
import { parseMarketplaceUrl } from "@/lib/marketplace-url";

export type GrabbedProduct = {
  sourceUrl: string;
  marketplace: "shopee" | "tokopedia" | "tiktok" | null;
  /**
   * Ketersediaan stok di sumber, dari schema.org/offers.availability atau meta
   * product:availability. "unknown" bila halaman tidak mengeksposnya — banyak
   * marketplace merender stok via JS, jadi fetch server sering tak melihatnya.
   * Dipakai mesin sinkronisasi untuk auto-sembunyi produk yang habis.
   */
  availability: Availability;
  title: string;
  description: string;
  brand: string;
  currency: string;
  price: number | null;
  salePrice: number | null;
  images: string[];
  usedAi: boolean;
  discountPercent: number | null;
  priceIssues: PriceIssue[];
};

function decodeEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function absolute(src: string, base: string): string | null {
  try {
    const url = new URL(src, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function meta(html: string, key: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${key}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return null;
}

function allMeta(html: string, key: string): string[] {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`,
    "gi",
  );
  const out: string[] = [];
  for (const m of html.matchAll(re)) if (m[1]) out.push(decodeEntities(m[1]).trim());
  return out;
}

function toNumber(value: unknown): number | null {
  return parsePriceValue(value);
}

function flattenJsonLd(node: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) {
    for (const item of node) flattenJsonLd(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  out.push(obj);
  if (obj["@graph"]) flattenJsonLd(obj["@graph"], out);
  if (obj.mainEntity) flattenJsonLd(obj.mainEntity, out);
  if (obj.itemListElement) flattenJsonLd(obj.itemListElement, out);
}

function jsonLdProducts(html: string): Record<string, unknown>[] {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const nodes: Record<string, unknown>[] = [];
  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw) continue;
    try {
      flattenJsonLd(JSON.parse(raw), nodes);
    } catch {
      /* ignore malformed blocks */
    }
  }
  return nodes.filter((n) => {
    const type = n["@type"];
    const types = Array.isArray(type) ? type : [type];
    return types.some((t) => typeof t === "string" && /product/i.test(t));
  });
}

function detectMarketplace(url: string): GrabbedProduct["marketplace"] {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (/shopee\./i.test(host)) return "shopee";
  if (/tokopedia\./i.test(host)) return "tokopedia";
  if (/tiktok(shop)?\./i.test(host)) return "tiktok";
  return null;
}

async function aiExtract(text: string, url: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract product data from raw page text. Reply with JSON only: {title, description, brand, price, salePrice, currency}. Prices must be plain integers in the page currency, or null. description: max 400 chars, Indonesian if the page is Indonesian.",
          },
          { role: "user", content: `URL: ${url}\n\nPAGE TEXT:\n${text.slice(0, 6000)}` },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`AI grab fallback failed [${res.status}]: ${await res.text()}`);
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    console.error("AI grab fallback error", error);
    return null;
  }
}

export async function grabProductFromUrl(rawUrl: string): Promise<GrabbedProduct> {
  const target = new URL(rawUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("URL harus memakai http atau https");
  }

  // Shopee: coba Apify dulu — cloud-nya menembus anti-bot yang memblokir fetch
  // langsung kita (403 + captcha). Kalau berhasil, pakai datanya & lewati jalur
  // HTML di bawah. Kalau token belum diisi / gagal, lanjut ke HTML seperti biasa.
  if (parseMarketplaceUrl(rawUrl)?.marketplace === "shopee" && (await isApifyConfigured())) {
    const it = (await runShopeeByUrls([rawUrl]))[0];
    if (it && (typeof it.price === "number" || typeof it.priceMin === "number")) {
      const out = shopeeItemToOutcome(it);
      return {
        sourceUrl: it.url || target.toString(),
        marketplace: "shopee",
        availability: out.availability,
        title: (it.name ?? "").slice(0, 140).trim(),
        description: "",
        brand: "",
        currency: it.currency || "IDR",
        price: out.price,
        salePrice: out.salePrice,
        images: (Array.isArray(it.images) ? it.images : it.image ? [it.image] : []).slice(0, 8),
        usedAi: false,
        discountPercent: typeof it.discountPercent === "number" ? it.discountPercent : null,
        priceIssues: [],
      };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let html = "";
  try {
    const res = await fetch(target.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "id-ID,id;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`Halaman menolak permintaan (HTTP ${res.status})`);
    html = await res.text();
  } catch (error) {
    if ((error as Error).name === "AbortError") throw new Error("Halaman terlalu lama merespons");
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const base = target.toString();
  const products = jsonLdProducts(html);
  const product = products[0] ?? {};

  const offersRaw = product.offers;
  const offers = (Array.isArray(offersRaw) ? offersRaw : [offersRaw]).filter(
    (o): o is Record<string, unknown> => !!o && typeof o === "object",
  );
  const offerPrices = offers
    .flatMap((o) => [o.price, o.lowPrice, (o.priceSpecification as Record<string, unknown>)?.price])
    .map(toNumber)
    .filter((n): n is number => n !== null);

  const ldImages = (() => {
    const raw = product.image;
    const list = Array.isArray(raw) ? raw : [raw];
    return list
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const url = (item as Record<string, unknown>).url;
          return typeof url === "string" ? url : null;
        }
        return null;
      })
      .filter((v): v is string => !!v);
  })();

  const brandLd = (() => {
    const brand = product.brand;
    if (typeof brand === "string") return brand;
    if (brand && typeof brand === "object") {
      const name = (brand as Record<string, unknown>).name;
      if (typeof name === "string") return name;
    }
    return "";
  })();

  const ogImages = [
    ...allMeta(html, "og:image"),
    ...allMeta(html, "og:image:secure_url"),
    ...allMeta(html, "twitter:image"),
  ];
  const linkImage = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1];

  const images = Array.from(
    new Set(
      [...ldImages, ...ogImages, ...(linkImage ? [linkImage] : [])]
        .map((src) => absolute(src, base))
        .filter((v): v is string => !!v),
    ),
  ).slice(0, 8);

  const metaPrice =
    toNumber(meta(html, "product:price:amount")) ??
    toNumber(meta(html, "og:price:amount")) ??
    toNumber(meta(html, "price"));

  let title =
    (typeof product.name === "string" ? product.name : "") ||
    meta(html, "og:title") ||
    meta(html, "twitter:title") ||
    decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");

  let description =
    (typeof product.description === "string" ? product.description : "") ||
    meta(html, "og:description") ||
    meta(html, "description") ||
    "";

  let brand = brandLd || meta(html, "product:brand") || "";
  let currency =
    (offers.find((o) => typeof o.priceCurrency === "string")?.priceCurrency as string) ||
    meta(html, "product:price:currency") ||
    meta(html, "og:price:currency") ||
    "IDR";

  const sorted = [...offerPrices].sort((a, b) => b - a);
  let price: number | null = sorted[0] ?? metaPrice ?? null;
  let salePrice: number | null = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  let usedAi = false;
  if (!title || price === null) {
    const ai = await aiExtract(stripTags(html), base);
    if (ai) {
      usedAi = true;
      if (!title && typeof ai.title === "string") title = ai.title;
      if (!description && typeof ai.description === "string") description = ai.description;
      if (!brand && typeof ai.brand === "string") brand = ai.brand;
      if (typeof ai.currency === "string" && !currency) currency = ai.currency;
      if (price === null) price = toNumber(ai.price);
      if (salePrice === null) {
        const aiSale = toNumber(ai.salePrice);
        if (aiSale !== null && price !== null && aiSale < price) salePrice = aiSale;
      }
    }
  }

  const normalized = normalizePrices(price, salePrice);
  price = normalized.price;
  salePrice = normalized.salePrice;
  if (currency && currency.toUpperCase() !== "IDR") {
    normalized.issues.push({
      level: "warning",
      code: "currency_mismatch",
      field: "both",
      title: "Mata uang bukan Rupiah",
      detail: `Halaman sumber mencantumkan harga dalam ${currency.toUpperCase()}, sedangkan form produk memakai Rupiah.`,
      action: "Angka diterapkan apa adanya — konversi manual bila perlu.",
    });
  }

  // Ketersediaan: kumpulkan semua sinyal (offers + meta), "tersedia" menang atas
  // "habis" supaya tidak salah menyembunyikan produk yang masih ada.
  const availabilitySignals = [
    ...offers.map((o) => o.availability).filter((a): a is string => typeof a === "string"),
    meta(html, "product:availability"),
    meta(html, "og:availability"),
  ].filter((a): a is string => typeof a === "string" && a.length > 0);
  const availability: Availability = availabilitySignals.some(
    (s) => normalizeAvailability(s) === "in",
  )
    ? "in"
    : availabilitySignals.some((s) => normalizeAvailability(s) === "out")
      ? "out"
      : "unknown";

  return {
    sourceUrl: base,
    marketplace: detectMarketplace(base),
    availability,
    title: title.slice(0, 140).trim(),
    description: stripTags(description).slice(0, 2000),
    brand: brand.slice(0, 80).trim(),
    currency,
    price,
    salePrice,
    images,
    usedAi,
    discountPercent: normalized.discountPercent,
    priceIssues: normalized.issues,
  };
}
