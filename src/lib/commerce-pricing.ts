/** Shared pricing rules — imported by both the checkout UI and the server. */

export const SHIPPING_FEE = 20000;

export type PromoType = "percent" | "flat" | "shipping";

export interface Promo {
  code: string;
  label: string;
  type: PromoType;
  value: number;
  /** ISO date after which the code no longer works. */
  expiresAt?: string;
  /** Minimum item subtotal required, in rupiah. */
  minSubtotal?: number;
}

export const PROMOS: Promo[] = [
  { code: "SAVE10", label: "10% off your items", type: "percent", value: 10 },
  {
    code: "HEMAT25K",
    label: "Rp25.000 off your items",
    type: "flat",
    value: 25000,
    minSubtotal: 100000,
  },
  { code: "FREESHIP", label: "Free standard shipping", type: "shipping", value: 0 },
  {
    code: "NEWYEAR24",
    label: "20% off your items",
    type: "percent",
    value: 20,
    expiresAt: "2025-01-31",
  },
];

export function findPromo(code: string): Promo | undefined {
  return PROMOS.find((p) => p.code === code.trim().toUpperCase());
}

export function validatePromo(
  rawCode: string,
  subtotal: number,
): { promo: Promo } | { error: string } {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { error: "Enter a promo code to apply it." };
  if (!/^[A-Z0-9-]{1,20}$/.test(code)) {
    return { error: "Promo codes can only contain letters, numbers, and dashes." };
  }
  const found = findPromo(code);
  if (!found) return { error: `"${code}" isn't a valid promo code.` };
  if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
    return { error: `"${code}" has expired.` };
  }
  if (found.minSubtotal && subtotal < found.minSubtotal) {
    return {
      error: `"${code}" needs a minimum subtotal of Rp${found.minSubtotal.toLocaleString("id-ID")}.`,
    };
  }
  return { promo: found };
}

/** Keadaan katalog terkini sebuah item saat checkout (di-resolve dari DB). */
export interface CheckoutItemState {
  title: string;
  /** Harga yang akan DIBAYAR pembeli (dari keranjang klien). */
  unitPrice: number;
  /** admin_products.status ('active' | 'draft' | 'out_of_stock'). */
  status: string;
  /** Modal terakhir hasil sinkron (product_sync_state.source_price); null bila belum pernah. */
  modal: number | null;
}

/**
 * Alasan sebuah item HARUS ditolak saat checkout, atau null bila aman. Menutup
 * celah antara pembeli memasukkan keranjang dan harga/stok supplier berubah:
 * (1) produk sudah tak tayang (mis. auto-hide karena rugi/habis) → tolak;
 * (2) modal terkini >= harga yang dibayar → fulfill akan RUGI → tolak.
 * Produk non-katalog (tak ter-resolve) tidak dilewatkan ke fungsi ini.
 */
export function checkoutBlockReason(item: CheckoutItemState): string | null {
  if (item.status !== "active") {
    return `"${item.title}" sedang tidak tersedia — stok atau harga baru saja berubah. Muat ulang halaman lalu coba lagi.`;
  }
  if (item.modal != null && item.unitPrice > 0 && item.modal >= item.unitPrice) {
    return `Harga "${item.title}" baru saja berubah. Muat ulang halaman untuk harga terbaru sebelum memesan.`;
  }
  return null;
}

/** Deterministic totals used on both sides so the summary always matches. */
export function computeTotals(subtotal: number, promo: Promo | null) {
  let discount = 0;
  let shipping = subtotal > 0 ? SHIPPING_FEE : 0;
  if (promo?.type === "percent") discount = Math.round((subtotal * promo.value) / 100);
  if (promo?.type === "flat") discount = Math.min(promo.value, subtotal);
  if (promo?.type === "shipping") shipping = 0;
  return { subtotal, discount, shipping, total: Math.max(0, subtotal - discount) + shipping };
}
