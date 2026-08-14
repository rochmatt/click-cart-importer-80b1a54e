// Margin bertingkat untuk dropship: berdasarkan MODAL (harga beli marketplace),
// tiap rentang punya margin NOMINAL tetap (Rp). Harga jual saran = modal + margin.
// Murni & teruji — sisi efek (baca/tulis store_settings) ada di admin.functions.ts.

import { rupiah } from "@/lib/product-sync";

/**
 * Satu tingkat margin. `maxModal` = batas ATAS modal (eksklusif) untuk tingkat ini;
 * `null` = tingkat teratas (menangkap semua modal ≥ batas tingkat sebelumnya).
 * `marginRp` = tambahan nominal tetap ke modal untuk memperoleh harga jual.
 */
export type MarginTier = { id: string; maxModal: number | null; marginRp: number };

/** Bracket default (sesuai permintaan). Semua margin 0 — diisi manual oleh admin. */
export const DEFAULT_MARGIN_TIERS: Omit<MarginTier, "id">[] = [
  { maxModal: 50000, marginRp: 0 },
  { maxModal: 100000, marginRp: 0 },
  { maxModal: 200000, marginRp: 0 },
  { maxModal: 500000, marginRp: 0 },
  { maxModal: 700000, marginRp: 0 },
  { maxModal: 1000000, marginRp: 0 },
  { maxModal: 2000000, marginRp: 0 },
  { maxModal: null, marginRp: 0 },
];

/** Urut menaik berdasarkan maxModal; tingkat `null` (catch-all) selalu terakhir. */
export function sortTiers(tiers: MarginTier[]): MarginTier[] {
  return [...tiers].sort((a, b) => {
    if (a.maxModal === null) return 1;
    if (b.maxModal === null) return -1;
    return a.maxModal - b.maxModal;
  });
}

/** Margin (Rp) untuk sebuah modal: tingkat pertama yang batas atasnya belum terlampaui. */
export function marginForModal(modal: number, tiers: MarginTier[]): number {
  for (const t of sortTiers(tiers)) {
    if (t.maxModal === null || modal < t.maxModal) return Math.max(0, Math.round(t.marginRp));
  }
  return 0;
}

/** Harga jual saran = modal + margin tingkatnya. `null` bila modal tak valid. */
export function suggestPriceFromModal(
  modal: number | null | undefined,
  tiers: MarginTier[],
): number | null {
  if (modal == null || !Number.isFinite(modal) || modal < 0) return null;
  return Math.round(modal) + marginForModal(modal, tiers);
}

/** Apakah ada margin yang benar-benar diisi (>0)? Dipakai untuk mengaktifkan saran. */
export function hasConfiguredMargins(tiers: MarginTier[]): boolean {
  return tiers.some((t) => Math.round(t.marginRp) > 0);
}

/** Label rentang tingkat untuk UI, mis. "< Rp50.000", "Rp50.000–Rp100.000", "≥ Rp2.000.000". */
export function tierLabel(tier: MarginTier, lowerBound: number): string {
  if (tier.maxModal === null) return `≥ ${rupiah(lowerBound)}`;
  if (lowerBound <= 0) return `< ${rupiah(tier.maxModal)}`;
  return `${rupiah(lowerBound)}–${rupiah(tier.maxModal)}`;
}

/** Tingkat + batas bawahnya (untuk merender daftar berlabel di UI). */
export function tiersWithBounds(tiers: MarginTier[]): { tier: MarginTier; lower: number }[] {
  const sorted = sortTiers(tiers);
  let lower = 0;
  return sorted.map((tier) => {
    const row = { tier, lower };
    lower = tier.maxModal ?? lower;
    return row;
  });
}
