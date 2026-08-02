/**
 * Shared price/discount validation + normalization for grabbed product data.
 * Used by the server scraper and by the admin UI before applying to the form.
 */

export const MAX_PRICE = 500_000_000; // Rp 500 jt — batas wajar untuk katalog
export const MIN_PRICE = 100; // di bawah ini hampir pasti hasil parsing salah

export type PriceIssueLevel = "warning" | "error";

export type PriceIssueCode =
  | "unparsable"
  | "too_low"
  | "too_high"
  | "rounded"
  | "swapped"
  | "identical"
  | "sale_as_price"
  | "discount_too_small"
  | "discount_too_large"
  | "range_collapsed"
  | "currency_mismatch";

export type PriceIssue = {
  level: PriceIssueLevel;
  /** Machine-readable reason so the UI can label it consistently. */
  code: PriceIssueCode;
  /** Which value it concerns. */
  field: "price" | "salePrice" | "both";
  /** Short reason headline. */
  title: string;
  /** Specific explanation: nilai asli, nilai hasil, dan apa yang dilakukan. */
  detail: string;
  /** What the system did about it. */
  action: string;
};

export type NormalizedPrices = {
  price: number | null;
  salePrice: number | null;
  discountPercent: number | null;
  issues: PriceIssue[];
};

export const PRICE_ISSUE_LABELS: Record<PriceIssueCode, string> = {
  unparsable: "Nilai tidak bisa dibaca",
  too_low: "Nilai tak wajar (terlalu kecil)",
  too_high: "Nilai tak wajar (terlalu besar)",
  rounded: "Angka dibulatkan",
  swapped: "Harga diskon tertukar",
  identical: "Harga diskon sama dengan harga normal",
  sale_as_price: "Harga normal tidak terbaca",
  discount_too_small: "Selisih diskon tidak signifikan",
  discount_too_large: "Diskon terlalu besar",
  range_collapsed: "Rentang harga tidak konsisten",
  currency_mismatch: "Mata uang bukan Rupiah",
};

function idr(value: number): string {
  return `Rp${value.toLocaleString("id-ID")}`;
}

function rawText(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "kosong";
}


/**
 * Parse a raw price value (number or messy string) into a clean integer rupiah.
 * Handles: "Rp1.250.000", "1,250,000", "1.250.000,50", "Rp10.000 - Rp25.000",
 * "IDR 99000", "1.2jt", exponent junk, and stray unicode spaces.
 */
export function parsePriceValue(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value);
  }
  if (typeof value !== "string") return null;

  let text = value.replace(/\u00a0/g, " ").trim();
  if (!text) return null;

  // Range ("10.000 - 25.000" / "10rb–25rb") → ambil angka pertama (terendah).
  const rangeSplit = text.split(/\s*(?:-|–|—|s\/d|sampai|to)\s*/i);
  if (rangeSplit.length > 1 && rangeSplit[0] && /\d/.test(rangeSplit[0])) {
    text = rangeSplit[0];
  }

  // Suffix ribuan/jutaan: "1,2jt", "150rb", "2 juta".
  const suffix = text.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta|m|mio)\b/i);
  if (suffix?.[1] && suffix[2]) {
    const base = Number(suffix[1].replace(",", "."));
    if (Number.isFinite(base)) {
      const unit = suffix[2].toLowerCase();
      const factor = unit === "rb" || unit === "ribu" || unit === "k" ? 1_000 : 1_000_000;
      const scaled = Math.round(base * factor);
      return scaled > 0 ? scaled : null;
    }
  }

  const cleaned = text.replace(/[^\d.,]/g, "");
  if (!/\d/.test(cleaned)) return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized: string;

  if (lastDot === -1 && lastComma === -1) {
    normalized = cleaned;
  } else {
    const decimalIndex = Math.max(lastDot, lastComma);
    const tail = cleaned.slice(decimalIndex + 1);
    // Ekor 3 digit = pemisah ribuan (1.250.000), bukan desimal.
    const isDecimal = tail.length > 0 && tail.length <= 2;
    if (isDecimal) {
      const intPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
      normalized = `${intPart}.${tail}`;
    } else {
      normalized = cleaned.replace(/[.,]/g, "");
    }
  }

  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function validateSingle(
  value: number | null,
  label: string,
  issues: PriceIssue[],
): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) {
    issues.push({ level: "error", message: `${label} tidak valid dan diabaikan.` });
    return null;
  }
  const rounded = Math.round(value);
  if (rounded !== value) {
    issues.push({ level: "warning", message: `${label} dibulatkan ke ${rounded}.` });
  }
  if (rounded < MIN_PRICE) {
    issues.push({
      level: "error",
      message: `${label} (${rounded}) terlalu kecil — kemungkinan salah baca, jadi diabaikan.`,
    });
    return null;
  }
  if (rounded > MAX_PRICE) {
    issues.push({
      level: "error",
      message: `${label} (${rounded}) melebihi batas wajar dan diabaikan.`,
    });
    return null;
  }
  return rounded;
}

/**
 * Validate & normalize a price/salePrice pair, keeping the discount sane.
 */
export function normalizePrices(
  rawPrice: unknown,
  rawSalePrice: unknown,
): NormalizedPrices {
  const issues: PriceIssue[] = [];
  let price = validateSingle(parsePriceValue(rawPrice), "Harga normal", issues);
  let salePrice = validateSingle(parsePriceValue(rawSalePrice), "Harga diskon", issues);

  if (price !== null && salePrice !== null) {
    if (salePrice > price) {
      // Sumber sering menukar posisi harga normal & diskon.
      [price, salePrice] = [salePrice, price];
      issues.push({
        level: "warning",
        message: "Harga diskon lebih besar dari harga normal — posisinya ditukar otomatis.",
      });
    }
    if (salePrice === price) {
      salePrice = null;
      issues.push({
        level: "warning",
        message: "Harga diskon sama dengan harga normal, jadi diskon dikosongkan.",
      });
    }
  }

  if (price === null && salePrice !== null) {
    price = salePrice;
    salePrice = null;
    issues.push({
      level: "warning",
      message: "Harga normal tidak terbaca — harga diskon dipakai sebagai harga normal.",
    });
  }

  let discountPercent: number | null = null;
  if (price !== null && salePrice !== null) {
    discountPercent = Math.round(((price - salePrice) / price) * 100);
    if (discountPercent < 1) {
      salePrice = null;
      discountPercent = null;
      issues.push({
        level: "warning",
        message: "Selisih diskon kurang dari 1% sehingga tidak dipakai.",
      });
    } else if (discountPercent > 95) {
      issues.push({
        level: "warning",
        message: `Diskon terdeteksi ${discountPercent}% — periksa lagi sebelum menyimpan.`,
      });
    }
  }

  return { price, salePrice, discountPercent, issues };
}
