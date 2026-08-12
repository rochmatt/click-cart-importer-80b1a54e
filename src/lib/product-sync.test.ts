// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decideProductSync,
  normalizeAvailability,
  sourceFingerprint,
  type SyncCurrent,
} from "./product-sync";

const AWAL: SyncCurrent = {
  adminStatus: "active",
  syncStatus: "idle",
  sourceHash: null,
  sourcePrice: null,
  failCount: 0,
  previousStatus: null,
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
