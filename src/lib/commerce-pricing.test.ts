// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkoutBlockReason, type CheckoutItemState } from "./commerce-pricing";

// Aman: aktif, harga katalog == klien, modal < harga jual.
const OK: CheckoutItemState = {
  title: "Mug",
  clientPrice: 50000,
  catalogPrice: 50000,
  status: "active",
  modal: 25000,
};

describe("checkoutBlockReason — guard + re-price saat checkout", () => {
  it("aman: aktif, harga cocok, untung → null", () => {
    expect(checkoutBlockReason(OK)).toBeNull();
  });

  it("tolak: produk tak aktif (auto-hide rugi/habis)", () => {
    expect(checkoutBlockReason({ ...OK, status: "out_of_stock" })).toMatch(/tidak tersedia/i);
    expect(checkoutBlockReason({ ...OK, status: "draft" })).toMatch(/tidak tersedia/i);
  });

  it("tolak: harga katalog > harga kiriman klien (harga naik / manipulasi murah)", () => {
    // harga katalog naik jadi 60000, klien kirim 50000 → tolak + sebut harga baru
    expect(checkoutBlockReason({ ...OK, catalogPrice: 60000 })).toMatch(/Rp60\.000/);
    // manipulasi: klien kirim 1, katalog 50000 → tolak
    expect(checkoutBlockReason({ ...OK, clientPrice: 1 })).toMatch(/berubah menjadi/i);
  });

  it("aman: harga katalog LEBIH RENDAH dari klien (mis. lagi diskon) → dipakai harga katalog", () => {
    expect(checkoutBlockReason({ ...OK, catalogPrice: 45000 })).toBeNull();
  });

  it("tolak: modal >= harga katalog (fulfill rugi, jaring pengaman)", () => {
    expect(checkoutBlockReason({ ...OK, modal: 55000 })).toMatch(/tidak tersedia/i);
    expect(checkoutBlockReason({ ...OK, modal: 50000 })).toMatch(/tidak tersedia/i);
  });

  it("aman: modal belum tersinkron (null)", () => {
    expect(checkoutBlockReason({ ...OK, modal: null })).toBeNull();
  });

  it("status tak aktif menang atas cek lain", () => {
    expect(
      checkoutBlockReason({ ...OK, status: "draft", catalogPrice: 99999, modal: 1 }),
    ).toMatch(/tidak tersedia/i);
  });
});
