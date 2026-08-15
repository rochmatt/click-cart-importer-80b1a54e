// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkoutBlockReason, type CheckoutItemState } from "./commerce-pricing";

const OK: CheckoutItemState = { title: "Mug", unitPrice: 50000, status: "active", modal: 25000 };

describe("checkoutBlockReason — guard saat checkout", () => {
  it("aman: produk aktif & modal < harga bayar → null", () => {
    expect(checkoutBlockReason(OK)).toBeNull();
  });

  it("tolak: produk tak aktif (auto-hide rugi/habis)", () => {
    expect(checkoutBlockReason({ ...OK, status: "out_of_stock" })).toMatch(/tidak tersedia/i);
    expect(checkoutBlockReason({ ...OK, status: "draft" })).toMatch(/tidak tersedia/i);
  });

  it("tolak: modal terkini >= harga yang dibayar (fulfill rugi)", () => {
    expect(checkoutBlockReason({ ...OK, modal: 60000 })).toMatch(/harga.*berubah/i);
    // modal == harga bayar juga ditolak (tak ada untung)
    expect(checkoutBlockReason({ ...OK, modal: 50000 })).toMatch(/harga.*berubah/i);
  });

  it("aman: modal belum tersinkron (null) → tak diblok karena harga", () => {
    expect(checkoutBlockReason({ ...OK, modal: null })).toBeNull();
  });

  it("status tak aktif menang atas cek margin", () => {
    expect(checkoutBlockReason({ ...OK, status: "draft", modal: 10000 })).toMatch(/tidak tersedia/i);
  });

  it("harga bayar 0 tak memicu blok margin (mis. item gratis/bonus)", () => {
    expect(checkoutBlockReason({ ...OK, unitPrice: 0, modal: 5000 })).toBeNull();
  });
});
