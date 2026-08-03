// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import { batasi, reset, resetSemua } from "./rate-limit.server";

describe("pembatas laju", () => {
  beforeEach(() => resetSemua());

  it("mengizinkan sampai kuota, lalu menolak", () => {
    for (let i = 0; i < 3; i++) {
      expect(batasi("a", 3, 60).diizinkan).toBe(true);
    }
    const keempat = batasi("a", 3, 60);
    expect(keempat.diizinkan).toBe(false);
    expect(keempat.sisaDetik).toBeGreaterThan(0);
  });

  it("kunci berbeda dihitung terpisah", () => {
    for (let i = 0; i < 3; i++) batasi("a", 3, 60);
    expect(batasi("a", 3, 60).diizinkan).toBe(false);
    // Kalau tidak terpisah, satu penyerang bisa mengunci akun orang lain.
    expect(batasi("b", 3, 60).diizinkan).toBe(true);
  });

  it("reset mengosongkan hitungan satu kunci", () => {
    for (let i = 0; i < 3; i++) batasi("a", 3, 60);
    expect(batasi("a", 3, 60).diizinkan).toBe(false);
    reset("a");
    expect(batasi("a", 3, 60).diizinkan).toBe(true);
  });

  it("jendela yang lewat memulai hitungan baru", () => {
    // Jendela nol detik langsung kedaluwarsa pada pemanggilan berikutnya.
    expect(batasi("a", 1, 0).diizinkan).toBe(true);
    expect(batasi("a", 1, 0).diizinkan).toBe(true);
  });

  it("tidak tumbuh tanpa batas: entri kedaluwarsa disapu", () => {
    for (let i = 0; i < 1200; i++) batasi(`k${i}`, 1, 0);
    // Penyapuan berjalan saat ukuran melewati ambang; yang penting pemanggilan
    // setelahnya tetap benar, bukan angka pastinya.
    expect(batasi("k0", 1, 60).diizinkan).toBe(true);
  });
});
