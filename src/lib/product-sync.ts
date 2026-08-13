// Logika murni mesin sinkronisasi produk (Fase 1–3). Sengaja tanpa DB/jaringan
// supaya keputusannya bisa diuji langsung — lihat product-sync.test.ts. Sisi
// efek (fetch sumber, tulis DB, kirim email) ada di product-sync.server.ts.

export type Availability = "in" | "out" | "unknown";

/** Format Rupiah tanpa bergantung ICU (deterministik di test maupun runtime). */
export function rupiah(n: number): string {
  return (
    "Rp" +
    Math.round(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

/**
 * Memetakan string ketersediaan (schema.org / meta OpenGraph) ke tiga keadaan.
 *
 * Konservatif: kalau ada sinyal "tersedia" ia menang atas "habis" — lebih baik
 * TIDAK menyembunyikan produk yang masih ada daripada salah sembunyi. Nilai yang
 * tak dikenal -> "unknown", yang tidak pernah memicu aksi apa pun.
 */
export function normalizeAvailability(raw: string | null | undefined): Availability {
  if (!raw) return "unknown";
  const v = raw.toLowerCase().replace(/[^a-z]/g, "");
  const tersedia = [
    "instock",
    "presale",
    "preorder",
    "backorder",
    "limitedavailability",
    "onlineonly",
    "instoreonly",
    "madetoorder",
  ];
  const habis = ["outofstock", "soldout", "discontinued"];
  if (tersedia.some((s) => v.includes(s))) return "in";
  if (habis.some((s) => v.includes(s))) return "out";
  return "unknown";
}

/** Sidik jari perubahan: cukup untuk membedakan "ada yang berubah" vs "sama". */
export function sourceFingerprint(
  price: number | null,
  salePrice: number | null,
  availability: Availability,
): string {
  return `${price ?? ""}|${salePrice ?? ""}|${availability}`;
}

/** Keadaan tersimpan sebuah produk sebelum dicek ulang. */
export interface SyncCurrent {
  /** admin_products.status ('active' | 'draft' | 'out_of_stock'). */
  adminStatus: string;
  /** product_sync_state.status ('idle' | 'ok' | 'out_of_stock' | 'margin_loss' | 'error'). */
  syncStatus: string;
  sourceHash: string | null;
  sourcePrice: number | null;
  failCount: number;
  previousStatus: string | null;
  /** Harga jual efektif admin (sale_price ?? price), untuk cek margin. null = tak dievaluasi. */
  sellingPrice: number | null;
}

/** Hasil membaca halaman sumber. */
export type GrabOutcome =
  | { ok: true; price: number | null; salePrice: number | null; availability: Availability }
  | { ok: false; error: string };

export type SyncEventType =
  | "out_of_stock"
  | "back_in_stock"
  | "price_up"
  | "price_down"
  | "margin_loss"
  | "margin_thin"
  | "margin_ok"
  | "error"
  | "recovered";

export interface SyncEvent {
  type: SyncEventType;
  detail: string;
}

export interface SyncDecision {
  /** Nilai baru product_sync_state.status. */
  syncStatus: string;
  sourceHash: string | null;
  sourcePrice: number | null;
  failCount: number;
  previousStatus: string | null;
  lastError: string | null;
  /** Nilai baru admin_products.status, atau null bila tak perlu diubah. */
  adminStatus: string | null;
  /** Perubahan yang layak masuk ringkasan email, atau null bila tidak ada. */
  event: SyncEvent | null;
}

/**
 * Memutuskan apa yang berubah dari satu produk berdasarkan bacaan sumber.
 *
 * Model "LAYAK JUAL" (dropship): produk boleh tayang bila ADA STOK **dan** UNTUNG.
 * Kalau tidak → disembunyikan (status admin -> out_of_stock), dengan alasan di
 * syncStatus: 'out_of_stock' (habis) atau 'margin_loss' (modal ≥ harga jual).
 *
 * Prinsip keamanan:
 * - Gagal membaca sumber TIDAK PERNAH menyembunyikan produk (anti-bot bisa nolak
 *   sesekali). Hanya sinyal EKSPLISIT (habis / rugi) yang menyembunyikan.
 * - Harga jual admin tidak pernah ditimpa — modal (sourcePrice) hanya untuk
 *   hitung margin & laporan.
 * - `minMarkupPct`: ambang markup MINIMUM (dari modal) untuk alert "margin tipis";
 *   RUGI (modal ≥ jual) selalu disembunyikan apa pun ambangnya.
 */
export function decideProductSync(
  current: SyncCurrent,
  grab: GrabOutcome,
  minMarkupPct = 15,
): SyncDecision {
  if (!grab.ok) {
    const failCount = current.failCount + 1;
    const transisiKeError = current.syncStatus !== "error";
    return {
      syncStatus: "error",
      sourceHash: current.sourceHash, // pertahankan nilai terakhir yang diketahui
      sourcePrice: current.sourcePrice,
      failCount,
      previousStatus: current.previousStatus,
      lastError: grab.error.slice(0, 300),
      adminStatus: null, // JANGAN sembunyikan katalog karena gagal scrape
      event: transisiKeError
        ? { type: "error", detail: `Gagal baca sumber: ${grab.error.slice(0, 120)}` }
        : null,
    };
  }

  const availability = grab.availability;
  const cost = grab.salePrice ?? grab.price; // harga MODAL efektif di sumber
  const selling = current.sellingPrice;
  const wasHiddenStock = current.syncStatus === "out_of_stock";
  const wasHiddenMargin = current.syncStatus === "margin_loss";
  const wasHidden = wasHiddenStock || wasHiddenMargin;

  const hasil: SyncDecision = {
    syncStatus: "ok",
    sourceHash: sourceFingerprint(grab.price, grab.salePrice, availability),
    sourcePrice: cost,
    failCount: 0,
    previousStatus: current.previousStatus,
    lastError: null,
    adminStatus: null,
    event: null,
  };

  // 1) STOK habis menang atas segalanya — tak bisa jual yang tak ada.
  if (availability === "out") {
    hasil.syncStatus = "out_of_stock";
    if (!wasHiddenStock) {
      hasil.event = { type: "out_of_stock", detail: "Stok habis di sumber" };
      if (current.adminStatus === "active") {
        hasil.adminStatus = "out_of_stock";
        hasil.previousStatus = "active";
      }
    }
    return hasil;
  }

  // 2) unknown & sebelumnya disembunyikan karena stok → biarkan tersembunyi.
  if (availability === "unknown" && wasHiddenStock) {
    hasil.syncStatus = "out_of_stock";
    return hasil;
  }

  const bisaHitungMargin = selling != null && cost != null;

  // 3) RUGI: modal ≥ harga jual → auto-sembunyikan (jangan jual rugi).
  if (bisaHitungMargin && cost! >= selling!) {
    hasil.syncStatus = "margin_loss";
    if (!wasHiddenMargin) {
      hasil.event = {
        type: "margin_loss",
        detail: `RUGI: modal ${rupiah(cost!)} ≥ harga jual ${rupiah(selling!)} — disembunyikan`,
      };
      if (current.adminStatus === "active") {
        hasil.adminStatus = "out_of_stock";
        hasil.previousStatus = "active";
      }
    }
    return hasil;
  }

  // 4) Layak jual (ada stok & untung). Pulihkan bila tadinya disembunyikan.
  if (wasHidden) {
    hasil.event = wasHiddenMargin
      ? { type: "margin_ok", detail: "Margin sehat lagi — ditampilkan kembali" }
      : { type: "back_in_stock", detail: "Tersedia lagi di sumber" };
    if (current.previousStatus === "active" && current.adminStatus === "out_of_stock") {
      hasil.adminStatus = "active";
      hasil.previousStatus = null;
    }
    return hasil;
  }

  // 5) Pulih dari error.
  if (current.syncStatus === "error") {
    hasil.event = { type: "recovered", detail: "Sumber bisa dibaca lagi" };
    return hasil;
  }

  // 6) Modal berubah → laporkan (dan bila jadi tipis, itu yang lebih penting).
  if (current.sourcePrice != null && cost != null && cost !== current.sourcePrice) {
    if (bisaHitungMargin && cost > 0) {
      const markup = Math.round(((selling! - cost) / cost) * 100);
      if (markup < minMarkupPct) {
        hasil.event = {
          type: "margin_thin",
          detail: `Margin tipis: markup ${markup}% (modal ${rupiah(cost)}, jual ${rupiah(selling!)})`,
        };
        return hasil;
      }
    }
    const selisih = cost - current.sourcePrice;
    const persen = current.sourcePrice > 0 ? Math.round((selisih / current.sourcePrice) * 100) : 0;
    hasil.event = {
      type: selisih > 0 ? "price_up" : "price_down",
      detail: `Harga modal ${rupiah(current.sourcePrice)} → ${rupiah(cost)} (${persen > 0 ? "+" : ""}${persen}%)`,
    };
  }

  return hasil;
}

// --- Penjadwalan bertingkat (Fase 2) ---------------------------------------
//
// Seberapa sering sebuah produk dicek ulang, dalam JAM. Yang butuh perhatian
// dicek lebih sering; draft/ekor-panjang lebih jarang. Angka ini dipakai kueri
// kandidat di product-sync.server.ts — CASE di SQL harus mencerminkan URUTAN
// cabang fungsi ini.
export const TIER_HOURS = { error: 3, outOfStock: 4, active: 6, other: 24 } as const;

/** Interval cek (jam) untuk satu produk: status sync menang atas status admin. */
export function tierHoursFor(adminStatus: string, syncStatus: string): number {
  if (syncStatus === "error") return TIER_HOURS.error; // gagal → coba lagi lebih cepat
  if (syncStatus === "out_of_stock" || syncStatus === "margin_loss") return TIER_HOURS.outOfStock; // pantau restok/harga
  if (adminStatus === "active") return TIER_HOURS.active; // tayang → lebih penting
  return TIER_HOURS.other; // draft / ekor panjang
}

/** Label tier ringkas untuk tampilan dashboard. */
export function tierLabel(adminStatus: string, syncStatus: string): "sering" | "normal" | "jarang" {
  const h = tierHoursFor(adminStatus, syncStatus);
  if (h <= TIER_HOURS.outOfStock) return "sering";
  if (h <= TIER_HOURS.active) return "normal";
  return "jarang";
}
