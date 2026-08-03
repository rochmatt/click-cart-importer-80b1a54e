// @vitest-environment node
//
// Riwayat percobaan kirim ulang email.
//
// Yang paling perlu dibuktikan adalah bahwa percobaan yang DITOLAK ikut
// tercatat. Percobaan yang berhasil sudah meninggalkan jejak di dua tempat lain
// (email_logs dan email_throttle); yang ditolak tidak meninggalkan jejak di
// mana pun sebelum tabel ini ada — padahal justru penolakan itulah yang perlu
// ditinjau saat menyelidiki penyalahgunaan.

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { catatKirim, catatPercobaan, sebabPenolakan } from "./email-throttle.server";
import { prosesKirimUlang, MAKS_PER_IP } from "./kirim-ulang.server";
import { closePools, run } from "../db/pool.server";

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const P = "zzuji-percobaan";
const EMAIL = `${P}@contoh.test`;

interface Baris {
  kind: string;
  email: string;
  outcome: string;
  email_dikirim: boolean;
  sisa_detik: number;
  terpakai: number;
  ip: string | null;
}

async function bersihkan() {
  await run("DELETE FROM public.resend_attempts WHERE email LIKE $1", [`%${P}%`], OWNER);
  await run("DELETE FROM auth.email_throttle WHERE email LIKE $1", [`%${P}%`], OWNER);
}

const baca = () =>
  run<Baris>(
    "SELECT kind, email, outcome, email_dikirim, sisa_detik, terpakai, ip FROM public.resend_attempts WHERE email LIKE $1 ORDER BY created_at",
    [`%${P}%`],
    OWNER,
  );

describe.skipIf(!CONFIGURED)("riwayat percobaan kirim ulang", () => {
  beforeEach(bersihkan);

  afterAll(async () => {
    await bersihkan();
    await closePools();
  });

  it("mencatat percobaan yang diizinkan beserta apakah emailnya sungguhan dikirim", async () => {
    await catatPercobaan({
      jenis: "verifikasi",
      email: EMAIL,
      hasil: "diizinkan",
      emailDikirim: true,
      sisaDetik: 60,
      terpakai: 1,
      ip: "203.0.113.9",
    });

    const rows = await baca();
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe("diizinkan");
    expect(rows[0].email_dikirim).toBe(true);
    expect(rows[0].ip).toBe("203.0.113.9");
  });

  it("membedakan 'diizinkan tapi tidak dikirim' dari 'diizinkan dan dikirim'", async () => {
    // Keadaan ini terjadi untuk alamat yang tidak punya akun, atau yang sudah
    // terverifikasi. Tanpa dibedakan, admin yang menelusuri keluhan "email tidak
    // masuk" akan menyimpulkan pengirimannya gagal, padahal memang tidak ada
    // yang perlu dikirim.
    await catatPercobaan({
      jenis: "verifikasi",
      email: EMAIL,
      hasil: "diizinkan",
      emailDikirim: false,
      sisaDetik: 60,
      terpakai: 1,
      ip: null,
    });

    const rows = await baca();
    expect(rows[0].outcome).toBe("diizinkan");
    expect(rows[0].email_dikirim).toBe(false);
    expect(rows[0].ip).toBeNull();
  });

  it("mencatat penolakan — inti dari tabel ini", async () => {
    for (const hasil of ["ditolak_cooldown", "ditolak_kuota", "ditolak_ip"] as const) {
      await catatPercobaan({
        jenis: "verifikasi",
        email: EMAIL,
        hasil,
        emailDikirim: false,
        sisaDetik: 120,
        terpakai: 5,
        ip: "198.51.100.4",
      });
    }

    const rows = await baca();
    expect(rows.map((r) => r.outcome)).toEqual(["ditolak_cooldown", "ditolak_kuota", "ditolak_ip"]);
    expect(rows.every((r) => r.email_dikirim === false)).toBe(true);
  });

  it("email disimpan huruf kecil, apa pun cara mengetiknya", async () => {
    await catatPercobaan({
      jenis: "reset",
      email: EMAIL.toUpperCase(),
      hasil: "diizinkan",
      emailDikirim: true,
      sisaDetik: 0,
      terpakai: 1,
      ip: null,
    });

    const rows = await baca();
    expect(rows[0].email).toBe(EMAIL.toLowerCase());
  });

  it("outcome di luar daftar ditolak database, dan tidak melempar ke pemanggil", async () => {
    // Perekam tidak boleh menjatuhkan permintaan yang dicatatnya, dengan alasan
    // yang sama seperti audit log.
    await expect(
      catatPercobaan({
        jenis: "verifikasi",
        email: EMAIL,
        hasil: "entah_apa" as never,
        emailDikirim: false,
        sisaDetik: 0,
        terpakai: 0,
        ip: null,
      }),
    ).resolves.toBeUndefined();

    expect(await baca()).toHaveLength(0);
  });

  describe("sebabPenolakan", () => {
    it("membedakan kuota habis dari sekadar menunggu jeda", () => {
      // Keduanya sama-sama ditolak, tapi menuntut tindakan berbeda saat
      // ditinjau: jeda berarti tombolnya ditekan terlalu cepat, kuota habis
      // berarti alamat itu sudah lima kali diminta dalam sejam.
      expect(sebabPenolakan({ diizinkan: true, sisaDetik: 0, terpakai: 1, maks: 5 })).toBe(
        "diizinkan",
      );
      expect(sebabPenolakan({ diizinkan: false, sisaDetik: 60, terpakai: 1, maks: 5 })).toBe(
        "ditolak_cooldown",
      );
      expect(sebabPenolakan({ diizinkan: false, sisaDetik: 900, terpakai: 5, maks: 5 })).toBe(
        "ditolak_kuota",
      );
    });
  });

  describe("rantai lengkap prosesKirimUlang", () => {
    // Menguji bagian yang sesungguhnya berjalan saat tombol ditekan: memutuskan,
    // mengirim, mencatat. Perekamnya sendiri sudah terbukti bisa menulis di
    // kasus-kasus di atas — yang dibuktikan di sini adalah bahwa ia BENAR-BENAR
    // dipanggil, dengan label yang sesuai keputusan pembatas.
    it("mencatat percobaan pertama sebagai diizinkan dan yang kedua sebagai ditolak", async () => {
      const kirim = vi.fn().mockResolvedValue(true);

      const pertama = await prosesKirimUlang("verifikasi", EMAIL, "203.0.113.7", kirim);
      expect(pertama.diizinkan).toBe(true);
      expect(kirim).toHaveBeenCalledTimes(1);

      const kedua = await prosesKirimUlang("verifikasi", EMAIL, "203.0.113.7", kirim);
      expect(kedua.diizinkan).toBe(false);
      // Pengiriman TIDAK dipanggil lagi saat ditolak — kalau ini gagal, pembatas
      // hanya kosmetik dan emailnya tetap terkirim.
      expect(kirim).toHaveBeenCalledTimes(1);

      const rows = await baca();
      expect(rows.map((r) => r.outcome)).toEqual(["diizinkan", "ditolak_cooldown"]);
      expect(rows.map((r) => r.email_dikirim)).toEqual([true, false]);
      expect(rows.every((r) => r.ip === "203.0.113.7")).toBe(true);
    });

    it("mencatat email_dikirim=false saat alamatnya tidak layak dikirimi", async () => {
      const kirim = vi.fn().mockResolvedValue(false);
      const hasil = await prosesKirimUlang("verifikasi", EMAIL, null, kirim);

      expect(hasil.diizinkan).toBe(true);
      const rows = await baca();
      expect(rows[0].outcome).toBe("diizinkan");
      expect(rows[0].email_dikirim).toBe(false);
    });

    it("penolakan batas IP tercatat dan tidak mengurangi kuota alamat", async () => {
      const kirim = vi.fn().mockResolvedValue(true);
      const ip = "198.51.100.77";

      // Menghabiskan kuota IP dengan alamat lain, supaya kuota EMAIL uji tetap utuh.
      for (let i = 0; i < MAKS_PER_IP; i++) {
        await prosesKirimUlang("verifikasi", `lain-${i}-${P}@contoh.test`, ip, kirim);
      }

      const ditolak = await prosesKirimUlang("verifikasi", EMAIL, ip, kirim);
      expect(ditolak.diizinkan).toBe(false);
      // Kuota alamat uji belum tersentuh: penolakan IP tidak boleh memakannya.
      expect(ditolak.terpakai).toBe(0);

      const rows = await run<Baris>(
        "SELECT kind, email, outcome, email_dikirim, sisa_detik, terpakai, ip FROM public.resend_attempts WHERE email = $1",
        [EMAIL],
        OWNER,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].outcome).toBe("ditolak_ip");
    });
  });

  it("sebab penolakan yang dicatat cocok dengan keputusan pembatas sungguhan", async () => {
    // Menghubungkan kedua bagian: keputusan diambil catatKirim, labelnya
    // diturunkan sebabPenolakan. Diuji lewat pembatas nyata, bukan angka karangan.
    const pertama = await catatKirim("verifikasi", EMAIL);
    expect(sebabPenolakan(pertama)).toBe("diizinkan");

    const kedua = await catatKirim("verifikasi", EMAIL);
    expect(sebabPenolakan(kedua)).toBe("ditolak_cooldown");

    await catatPercobaan({
      jenis: "verifikasi",
      email: EMAIL,
      hasil: sebabPenolakan(kedua),
      emailDikirim: false,
      sisaDetik: kedua.sisaDetik,
      terpakai: kedua.terpakai,
      ip: null,
    });

    const rows = await baca();
    expect(rows[0].outcome).toBe("ditolak_cooldown");
    expect(rows[0].sisa_detik).toBeGreaterThan(0);
  });
});
