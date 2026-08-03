// @vitest-environment node
//
// Wajib node, bukan jsdom (default di vitest.config.ts): jsdom memasang objek
// crypto global miliknya sendiri yang tidak punya randomBytes, sehingga hashing
// gagal dengan "randomBytes is not a function". Berkas yang diuji ini murni
// server dan memang tidak pernah berjalan di browser.

import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "./password.server";

describe("hashing password", () => {
  it("password yang benar terverifikasi", async () => {
    const hash = await hashPassword("rahasia-yang-kuat-123");
    expect(await verifyPassword("rahasia-yang-kuat-123", hash)).toBe(true);
  });

  it("password yang salah ditolak", async () => {
    const hash = await hashPassword("rahasia-yang-kuat-123");
    expect(await verifyPassword("rahasia-yang-kuat-124", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("dua hash dari password sama berbeda (salt acak)", async () => {
    const a = await hashPassword("sama");
    const b = await hashPassword("sama");
    expect(a).not.toBe(b);
    // Keduanya tetap harus memverifikasi password yang sama.
    expect(await verifyPassword("sama", a)).toBe(true);
    expect(await verifyPassword("sama", b)).toBe(true);
  });

  it("formatnya memuat parameter biaya supaya bisa dinaikkan kelak", async () => {
    const hash = await hashPassword("apa saja");
    const [algo, n, r, p] = hash.split("$");
    expect(algo).toBe("scrypt");
    expect(Number(n)).toBeGreaterThanOrEqual(32768);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(hash.split("$")).toHaveLength(6);
  });

  it("password panjang dan berkarakter unicode tetap bekerja", async () => {
    const pw = "kata sandi 🔐 dengan émoji dan spasi " + "x".repeat(200);
    const hash = await hashPassword(pw);
    expect(await verifyPassword(pw, hash)).toBe(true);
    expect(await verifyPassword(pw + "!", hash)).toBe(false);
  });

  describe("hash cacat dikembalikan false, tidak melempar", () => {
    // Melempar akan membedakan "hash rusak" dari "password salah" lewat
    // perilaku yang bisa diamati, dan itu membocorkan keadaan akun.
    const kasus: [string, string | null][] = [
      ["null", null],
      ["string kosong", ""],
      ["bukan format kami", "bcrypt$2a$10$abcdef"],
      ["jumlah bagian kurang", "scrypt$32768$8$1$c2FsdA=="],
      ["N bukan angka", "scrypt$abc$8$1$c2FsdA==$aGFzaA=="],
      ["salt kosong", "scrypt$32768$8$1$$aGFzaA=="],
      ["hash kosong", "scrypt$32768$8$1$c2FsdA==$"],
    ];
    for (const [nama, nilai] of kasus) {
      it(nama, async () => {
        expect(await verifyPassword("apa pun", nilai)).toBe(false);
      });
    }

    it("parameter raksasa ditolak sebelum scrypt dijalankan", async () => {
      // Tanpa batas atas, satu percobaan login bisa memaksa alokasi memori
      // raksasa — penolakan layanan lewat kolom yang tersimpan di database.
      const mulai = Date.now();
      const hasil = await verifyPassword("x", "scrypt$1073741824$999$999$c2FsdA==$aGFzaA==");
      expect(hasil).toBe(false);
      expect(Date.now() - mulai).toBeLessThan(1000);
    });
  });

  it("needsRehash menandai hash asing dan hash berbiaya lebih rendah", async () => {
    expect(needsRehash(null)).toBe(true);
    expect(needsRehash("bcrypt$2a$10$x")).toBe(true);
    expect(needsRehash("scrypt$16384$8$1$c2FsdA==$aGFzaA==")).toBe(true);
    expect(needsRehash(await hashPassword("baru"))).toBe(false);
  });
});
