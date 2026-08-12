import { describe, expect, it } from "vitest";
import { ringkasanFilterAktif } from "./category-filter-summary";

const kosong = { pencarian: "", hargaMin: 0, hargaMax: 0, rating: 0 };

describe("ringkasanFilterAktif — narasi untuk screen reader", () => {
  it("tanpa filter: menyebut tidak ada filter + jumlah produk", () => {
    expect(ringkasanFilterAktif(kosong, 3)).toBe("Tidak ada filter aktif. Menampilkan 3 produk.");
  });

  it("hanya pencarian", () => {
    expect(ringkasanFilterAktif({ ...kosong, pencarian: "lari" }, 2)).toBe(
      'Filter aktif: pencarian "lari". Menampilkan 2 produk.',
    );
  });

  it("rentang harga penuh (min & max)", () => {
    expect(ringkasanFilterAktif({ ...kosong, hargaMin: 250000, hargaMax: 750000 }, 2)).toBe(
      "Filter aktif: harga Rp250.000 hingga Rp750.000. Menampilkan 2 produk.",
    );
  });

  it("hanya batas bawah harga", () => {
    expect(ringkasanFilterAktif({ ...kosong, hargaMin: 500000 }, 2)).toBe(
      "Filter aktif: harga mulai Rp500.000. Menampilkan 2 produk.",
    );
  });

  it("hanya batas atas harga", () => {
    expect(ringkasanFilterAktif({ ...kosong, hargaMax: 1000000 }, 5)).toBe(
      "Filter aktif: harga hingga Rp1.000.000. Menampilkan 5 produk.",
    );
  });

  it("hanya rating", () => {
    expect(ringkasanFilterAktif({ ...kosong, rating: 4 }, 4)).toBe(
      "Filter aktif: rating 4 bintang ke atas. Menampilkan 4 produk.",
    );
  });

  it("gabungan semua filter, urutan pencarian → harga → rating", () => {
    expect(
      ringkasanFilterAktif(
        { pencarian: "sepatu", hargaMin: 250000, hargaMax: 750000, rating: 4.5 },
        1,
      ),
    ).toBe(
      'Filter aktif: pencarian "sepatu", harga Rp250.000 hingga Rp750.000, rating 4.5 bintang ke atas. Menampilkan 1 produk.',
    );
  });

  it("pencarian yang cuma spasi diabaikan", () => {
    expect(ringkasanFilterAktif({ ...kosong, pencarian: "   " }, 3)).toBe(
      "Tidak ada filter aktif. Menampilkan 3 produk.",
    );
  });

  it("nol produk cocok tetap dilaporkan", () => {
    expect(ringkasanFilterAktif({ ...kosong, rating: 4.5 }, 0)).toBe(
      "Filter aktif: rating 4.5 bintang ke atas. Menampilkan 0 produk.",
    );
  });
});
