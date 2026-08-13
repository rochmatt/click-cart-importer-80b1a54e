// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decideOrderFulfill,
  decideProductSync,
  normalizeAvailability,
  sourceFingerprint,
  tierHoursFor,
  TIER_HOURS,
  type OrderFulfillInput,
  type SyncCurrent,
} from "./product-sync";

const AWAL: SyncCurrent = {
  adminStatus: "active",
  syncStatus: "idle",
  sourceHash: null,
  sourcePrice: null,
  failCount: 0,
  previousStatus: null,
  sellingPrice: null,
};

describe("normalizeAvailability", () => {
  it("mengenali sinyal tersedia dari schema.org", () => {
    expect(normalizeAvailability("https://schema.org/InStock")).toBe("in");
    expect(normalizeAvailability("PreOrder")).toBe("in");
    expect(normalizeAvailability("https://schema.org/LimitedAvailability")).toBe("in");
  });

  it("mengenali sinyal habis", () => {
    expect(normalizeAvailability("https://schema.org/OutOfStock")).toBe("out");
    expect(normalizeAvailability("SoldOut")).toBe("out");
    expect(normalizeAvailability("out of stock")).toBe("out");
  });

  it("mengembalikan unknown untuk kosong/asing", () => {
    expect(normalizeAvailability(null)).toBe("unknown");
    expect(normalizeAvailability("")).toBe("unknown");
    expect(normalizeAvailability("entah")).toBe("unknown");
  });
});

describe("sourceFingerprint", () => {
  it("berubah saat harga/ketersediaan berubah, stabil saat sama", () => {
    expect(sourceFingerprint(100, 90, "in")).toBe(sourceFingerprint(100, 90, "in"));
    expect(sourceFingerprint(100, 90, "in")).not.toBe(sourceFingerprint(100, 90, "out"));
    expect(sourceFingerprint(100, 90, "in")).not.toBe(sourceFingerprint(100, 80, "in"));
  });
});

describe("decideProductSync — stok", () => {
  it("cek pertama tersedia: jadi ok tanpa event", () => {
    const d = decideProductSync(AWAL, {
      ok: true,
      price: 150000,
      salePrice: null,
      availability: "in",
    });
    expect(d.syncStatus).toBe("ok");
    expect(d.event).toBeNull();
    expect(d.adminStatus).toBeNull();
    expect(d.sourcePrice).toBe(150000);
    expect(d.failCount).toBe(0);
  });

  it("habis: menyembunyikan produk yang aktif + event", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sourcePrice: 150000 },
      { ok: true, price: 150000, salePrice: null, availability: "out" },
    );
    expect(d.syncStatus).toBe("out_of_stock");
    expect(d.adminStatus).toBe("out_of_stock");
    expect(d.previousStatus).toBe("active");
    expect(d.event?.type).toBe("out_of_stock");
  });

  it("habis tapi produk sudah draft: tetap lapor, tidak mengubah status admin", () => {
    const d = decideProductSync(
      { ...AWAL, adminStatus: "draft", syncStatus: "ok" },
      { ok: true, price: 1, salePrice: null, availability: "out" },
    );
    expect(d.syncStatus).toBe("out_of_stock");
    expect(d.adminStatus).toBeNull();
    expect(d.previousStatus).toBeNull();
    expect(d.event?.type).toBe("out_of_stock");
  });

  it("masih habis: idempoten, tanpa event ulang", () => {
    const d = decideProductSync(
      {
        ...AWAL,
        adminStatus: "out_of_stock",
        syncStatus: "out_of_stock",
        previousStatus: "active",
      },
      { ok: true, price: 1, salePrice: null, availability: "out" },
    );
    expect(d.syncStatus).toBe("out_of_stock");
    expect(d.adminStatus).toBeNull();
    expect(d.event).toBeNull();
  });

  it("tersedia lagi: memulihkan produk yang kita sembunyikan", () => {
    const d = decideProductSync(
      {
        ...AWAL,
        adminStatus: "out_of_stock",
        syncStatus: "out_of_stock",
        previousStatus: "active",
      },
      { ok: true, price: 150000, salePrice: null, availability: "in" },
    );
    expect(d.adminStatus).toBe("active");
    expect(d.previousStatus).toBeNull();
    expect(d.event?.type).toBe("back_in_stock");
  });

  it("unknown saat sebelumnya habis: biarkan tersembunyi", () => {
    const d = decideProductSync(
      {
        ...AWAL,
        adminStatus: "out_of_stock",
        syncStatus: "out_of_stock",
        previousStatus: "active",
      },
      { ok: true, price: 1, salePrice: null, availability: "unknown" },
    );
    expect(d.syncStatus).toBe("out_of_stock");
    expect(d.adminStatus).toBeNull();
    expect(d.event).toBeNull();
  });
});

describe("decideProductSync — harga", () => {
  it("harga sumber naik: event price_up, TIDAK mengubah status admin", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sourcePrice: 150000 },
      { ok: true, price: 175000, salePrice: null, availability: "in" },
    );
    expect(d.event?.type).toBe("price_up");
    expect(d.event?.detail).toContain("+17%");
    expect(d.adminStatus).toBeNull();
    expect(d.sourcePrice).toBe(175000);
  });

  it("harga turun: event price_down", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sourcePrice: 200000 },
      { ok: true, price: 150000, salePrice: null, availability: "in" },
    );
    expect(d.event?.type).toBe("price_down");
  });

  it("harga sumber tak berubah: tanpa event", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sourcePrice: 150000 },
      { ok: true, price: 150000, salePrice: null, availability: "in" },
    );
    expect(d.event).toBeNull();
  });
});

describe("decideProductSync — kegagalan", () => {
  it("gagal baca: status error, JANGAN sembunyikan katalog", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sourcePrice: 150000, sourceHash: "x" },
      { ok: false, error: "HTTP 403" },
    );
    expect(d.syncStatus).toBe("error");
    expect(d.adminStatus).toBeNull(); // katalog tidak disentuh
    expect(d.failCount).toBe(1);
    expect(d.sourceHash).toBe("x"); // nilai terakhir dipertahankan
    expect(d.event?.type).toBe("error");
  });

  it("gagal lagi: tanpa event ulang, penghitung naik", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "error", failCount: 2 },
      { ok: false, error: "timeout" },
    );
    expect(d.failCount).toBe(3);
    expect(d.event).toBeNull();
  });

  it("pulih setelah error: event recovered", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "error", failCount: 3, sourcePrice: 150000 },
      { ok: true, price: 150000, salePrice: null, availability: "in" },
    );
    expect(d.syncStatus).toBe("ok");
    expect(d.failCount).toBe(0);
    expect(d.event?.type).toBe("recovered");
  });
});

describe("decideProductSync — guard margin (dropship)", () => {
  it("RUGI (modal ≥ jual): auto-sembunyikan produk aktif + event", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sourcePrice: 70000, sellingPrice: 80000 },
      { ok: true, price: 90000, salePrice: null, availability: "in" },
    );
    expect(d.syncStatus).toBe("margin_loss");
    expect(d.adminStatus).toBe("out_of_stock");
    expect(d.previousStatus).toBe("active");
    expect(d.event?.type).toBe("margin_loss");
  });

  it("RUGI tapi produk draft: lapor, tak ubah status admin", () => {
    const d = decideProductSync(
      { ...AWAL, adminStatus: "draft", syncStatus: "ok", sellingPrice: 50000 },
      { ok: true, price: 60000, salePrice: null, availability: "in" },
    );
    expect(d.syncStatus).toBe("margin_loss");
    expect(d.adminStatus).toBeNull();
    expect(d.event?.type).toBe("margin_loss");
  });

  it("margin pulih (modal turun): tampilkan lagi + event margin_ok", () => {
    const d = decideProductSync(
      {
        ...AWAL,
        adminStatus: "out_of_stock",
        syncStatus: "margin_loss",
        previousStatus: "active",
        sellingPrice: 80000,
        sourcePrice: 90000,
      },
      { ok: true, price: 60000, salePrice: null, availability: "in" },
    );
    expect(d.adminStatus).toBe("active");
    expect(d.previousStatus).toBeNull();
    expect(d.event?.type).toBe("margin_ok");
  });

  it("stok habis menang atas margin", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sellingPrice: 80000 },
      { ok: true, price: 90000, salePrice: null, availability: "out" },
    );
    expect(d.syncStatus).toBe("out_of_stock");
    expect(d.event?.type).toBe("out_of_stock");
  });

  it("margin tipis (untung tapi < markup min) saat modal berubah: alert saja", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sourcePrice: 80000, sellingPrice: 100000 },
      { ok: true, price: 95000, salePrice: null, availability: "in" },
    );
    expect(d.event?.type).toBe("margin_thin");
    expect(d.adminStatus).toBeNull(); // TIDAK disembunyikan
    expect(d.syncStatus).toBe("ok");
  });

  it("margin sehat: lapor perubahan harga biasa, bukan alert margin", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sourcePrice: 90000, sellingPrice: 200000 },
      { ok: true, price: 100000, salePrice: null, availability: "in" },
    );
    expect(d.event?.type).toBe("price_up");
  });

  it("tanpa harga jual: margin tak dievaluasi (perilaku lama)", () => {
    const d = decideProductSync(
      { ...AWAL, syncStatus: "ok", sourcePrice: 100000, sellingPrice: null },
      { ok: true, price: 150000, salePrice: null, availability: "in" },
    );
    expect(d.event?.type).toBe("price_up");
    expect(d.adminStatus).toBeNull();
  });
});

describe("tierHoursFor — penjadwalan bertingkat", () => {
  it("error dicek paling sering, apa pun status admin", () => {
    expect(tierHoursFor("active", "error")).toBe(TIER_HOURS.error);
    expect(tierHoursFor("draft", "error")).toBe(TIER_HOURS.error);
  });

  it("out_of_stock dipantau untuk restok", () => {
    expect(tierHoursFor("active", "out_of_stock")).toBe(TIER_HOURS.outOfStock);
  });

  it("produk aktif dicek lebih sering daripada draft yang sehat", () => {
    expect(tierHoursFor("active", "ok")).toBe(TIER_HOURS.active);
    expect(tierHoursFor("draft", "ok")).toBe(TIER_HOURS.other);
    expect(tierHoursFor("active", "ok")).toBeLessThan(tierHoursFor("draft", "ok"));
  });

  it("status sync menang atas status admin (draft+error tetap sering)", () => {
    expect(tierHoursFor("draft", "error")).toBeLessThan(tierHoursFor("active", "ok"));
  });
});

describe("decideOrderFulfill — konfirmasi supplier sebelum fulfill", () => {
  const BACA: OrderFulfillInput = {
    resolved: true,
    linked: true,
    ok: true,
    error: null,
    availability: "in",
    cost: 30000,
    orderedUnitPrice: 50000,
  };

  it("produk tak ketemu di katalog → untracked", () => {
    const r = decideOrderFulfill({ ...BACA, resolved: false });
    expect(r.verdict).toBe("untracked");
    expect(r.note).toMatch(/tak ada di katalog/i);
  });

  it("produk tanpa link marketplace → untracked", () => {
    expect(decideOrderFulfill({ ...BACA, linked: false }).verdict).toBe("untracked");
  });

  it("gagal baca sumber → error (jangan simpulkan aman)", () => {
    const r = decideOrderFulfill({ ...BACA, ok: false, error: "HTTP 403" });
    expect(r.verdict).toBe("error");
    expect(r.note).toContain("403");
  });

  it("stok habis di supplier → out_of_stock, apa pun harganya", () => {
    const r = decideOrderFulfill({ ...BACA, availability: "out", cost: 1000 });
    expect(r.verdict).toBe("out_of_stock");
  });

  it("modal ≥ dibayar pelanggan → margin_loss (fulfill = rugi)", () => {
    const r = decideOrderFulfill({ ...BACA, cost: 60000, orderedUnitPrice: 50000 });
    expect(r.verdict).toBe("margin_loss");
    expect(r.note).toMatch(/RUGI/);
  });

  it("modal == dibayar juga margin_loss (tak ada untung)", () => {
    expect(decideOrderFulfill({ ...BACA, cost: 50000, orderedUnitPrice: 50000 }).verdict).toBe(
      "margin_loss",
    );
  });

  it("modal < dibayar & stok ada → ok dengan persen untung", () => {
    const r = decideOrderFulfill({ ...BACA, cost: 40000, orderedUnitPrice: 50000 });
    expect(r.verdict).toBe("ok");
    expect(r.note).toMatch(/untung 25%/); // (50000-40000)/40000 = 25%
  });

  it("stok tak terkonfirmasi (unknown) masih boleh ok, tapi disebut di catatan", () => {
    const r = decideOrderFulfill({ ...BACA, availability: "unknown" });
    expect(r.verdict).toBe("ok");
    expect(r.note).toMatch(/tak terkonfirmasi/i);
  });

  it("harga modal tak terbaca (cost null) → ok tapi tanpa klaim margin", () => {
    const r = decideOrderFulfill({ ...BACA, cost: null });
    expect(r.verdict).toBe("ok");
    expect(r.note).toMatch(/tak terbaca/i);
  });
});
