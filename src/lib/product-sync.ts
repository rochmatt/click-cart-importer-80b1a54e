// Logika murni mesin sinkronisasi produk (Fase 1). Sengaja tanpa DB/jaringan
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
  /** product_sync_state.status ('idle' | 'ok' | 'out_of_stock' | 'error'). */
  syncStatus: string;
  sourceHash: string | null;
  sourcePrice: number | null;
  failCount: number;
  previousStatus: string | null;
}

/** Hasil membaca halaman sumber. */
export type GrabOutcome =
  | { ok: true; price: number | null; salePrice: number | null; availability: Availability }
  | { ok: false; error: string };

export type SyncEventType =
  "out_of_stock" | "back_in_stock" | "price_up" | "price_down" | "error" | "recovered";

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
 * Prinsip keamanan:
 * - Gagal membaca sumber TIDAK PERNAH menyembunyikan produk. Anti-bot marketplace
 *   sering menolak sesekali; menyembunyikan katalog karena itu akan mengosongkan
 *   toko saat pemblokiran massal. Kegagalan hanya dicatat & dilaporkan.
 * - Hanya sinyal "habis" yang EKSPLISIT menyembunyikan. "unknown" tidak.
 * - Harga sumber tidak pernah menimpa harga jual — hanya memicu laporan.
 */
export function decideProductSync(current: SyncCurrent, grab: GrabOutcome): SyncDecision {
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
  const price = grab.salePrice ?? grab.price; // harga efektif di sumber
  const wasOOS = current.syncStatus === "out_of_stock";

  const hasil: SyncDecision = {
    syncStatus: "ok",
    sourceHash: sourceFingerprint(grab.price, grab.salePrice, availability),
    sourcePrice: price,
    failCount: 0,
    previousStatus: current.previousStatus,
    lastError: null,
    adminStatus: null,
    event: null,
  };

  if (availability === "out") {
    hasil.syncStatus = "out_of_stock";
    if (!wasOOS) {
      hasil.event = { type: "out_of_stock", detail: "Stok habis di sumber" };
      if (current.adminStatus === "active") {
        hasil.adminStatus = "out_of_stock"; // sembunyikan dari etalase
        hasil.previousStatus = "active"; // ingat untuk pemulihan
      }
    }
    return hasil; // saat habis, jangan pusingkan perubahan harga
  }

  if (availability === "in" && wasOOS) {
    hasil.event = { type: "back_in_stock", detail: "Tersedia lagi di sumber" };
    // Pulihkan HANYA jika produk masih dalam keadaan yang kita sembunyikan.
    // Kalau admin sudah menyentuhnya sendiri, adminStatus bukan 'out_of_stock'
    // lagi dan kita tidak memaksakan apa pun.
    if (current.previousStatus === "active" && current.adminStatus === "out_of_stock") {
      hasil.adminStatus = "active";
      hasil.previousStatus = null;
    }
    return hasil;
  }

  if (availability === "unknown" && wasOOS) {
    // Tak bisa memastikan restok — biarkan tetap tersembunyi, jangan tampilkan.
    hasil.syncStatus = "out_of_stock";
    return hasil;
  }

  // Sampai di sini: tersedia/unknown dan sebelumnya tidak habis.
  if (current.syncStatus === "error") {
    hasil.event = { type: "recovered", detail: "Sumber bisa dibaca lagi" };
    return hasil;
  }

  // Perubahan harga sumber (informasional; TIDAK menimpa harga jual admin).
  if (current.sourcePrice != null && price != null && price !== current.sourcePrice) {
    const selisih = price - current.sourcePrice;
    const persen = current.sourcePrice > 0 ? Math.round((selisih / current.sourcePrice) * 100) : 0;
    hasil.event = {
      type: selisih > 0 ? "price_up" : "price_down",
      detail: `Harga sumber ${rupiah(current.sourcePrice)} → ${rupiah(price)} (${persen > 0 ? "+" : ""}${persen}%)`,
    };
  }

  return hasil;
}
