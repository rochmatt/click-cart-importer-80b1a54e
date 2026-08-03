// @vitest-environment node
//
// Uji ujung-ke-ujung alur kirim ulang: pembatas, pengiriman, pencatatan, dan
// pemulihan saat layanan email bermasalah.
//
// Bedanya dengan email-throttle.test.ts: berkas itu menguji pembatasnya saja.
// Di sini seluruh rantai dijalankan lewat prosesKirimUlang — fungsi yang sama
// persis yang berjalan saat tombol ditekan — dengan Resend tiruan yang benar-
// benar menjawab lewat HTTP, bukan mock fungsi. Kesalahan penanganan status
// respons hanya terlihat kalau responsnya nyata.

import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prosesKirimUlang } from "./kirim-ulang.server";
import { MAKS_KIRIM, TANGGA_COOLDOWN, statusKirim } from "./email-throttle.server";
import { closePools, run } from "../db/pool.server";

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const P = "zzuji-e2e";
const EMAIL = `${P}@contoh.test`;

interface BarisPercobaan {
  outcome: string;
  email_dikirim: boolean;
  error_kirim: string | null;
}

let server: Server;
let balas: { status: number; body: string } = { status: 200, body: '{"id":"mock"}' };
let jumlahPermintaan = 0;
let envAsli: { endpoint?: string; key?: string; from?: string };

async function bersihkan() {
  await run("DELETE FROM public.resend_attempts WHERE email LIKE $1", [`%${P}%`], OWNER);
  await run("DELETE FROM auth.email_throttle WHERE email LIKE $1", [`%${P}%`], OWNER);
  await run("DELETE FROM public.email_logs WHERE recipient LIKE $1", [`%${P}%`], OWNER);
}

const percobaan = () =>
  run<BarisPercobaan>(
    "SELECT outcome, email_dikirim, error_kirim FROM public.resend_attempts WHERE email = $1 ORDER BY created_at",
    [EMAIL],
    OWNER,
  );

/** Menggeser cap waktu tersimpan mundur, mensimulasikan waktu berlalu. */
async function majuDetik(detik: number) {
  await run(
    `UPDATE auth.email_throttle
        SET attempts = (SELECT array_agg(a - make_interval(secs => $2) ORDER BY a) FROM unnest(attempts) a)
      WHERE email = $1`,
    [EMAIL.toLowerCase(), detik],
    OWNER,
  );
}

/** Mengirim lewat sendEmail sungguhan, menembak server tiruan di bawah. */
async function kirimSungguhan(): Promise<boolean> {
  const { sendEmail } = await import("@/lib/email/resend.server");
  await sendEmail({
    to: EMAIL,
    subject: "Uji",
    html: "<p>uji</p>",
    text: "uji",
    kind: "verifikasi-email",
  });
  return true;
}

describe.skipIf(!CONFIGURED)("kirim ulang ujung-ke-ujung", () => {
  beforeAll(async () => {
    server = createServer((req, res) => {
      jumlahPermintaan += 1;
      req.resume();
      res.writeHead(balas.status, { "content-type": "application/json" });
      res.end(balas.body);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;

    envAsli = {
      endpoint: process.env.RESEND_ENDPOINT,
      key: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
    };
    process.env.RESEND_ENDPOINT = `http://127.0.0.1:${port}/emails`;
    process.env.RESEND_API_KEY = "re_uji";
    process.env.EMAIL_FROM = "Uji <uji@contoh.test>";
  });

  afterAll(async () => {
    process.env.RESEND_ENDPOINT = envAsli.endpoint ?? "";
    process.env.RESEND_API_KEY = envAsli.key ?? "";
    process.env.EMAIL_FROM = envAsli.from ?? "";
    if (!envAsli.endpoint) delete process.env.RESEND_ENDPOINT;
    await new Promise<void>((r) => server.close(() => r()));
    await bersihkan();
    await closePools();
  });

  beforeEach(async () => {
    await bersihkan();
    balas = { status: 200, body: '{"id":"mock"}' };
    jumlahPermintaan = 0;
  });

  afterEach(bersihkan);

  // -------------------------------------------------- cooldown bertingkat

  describe("cooldown bertingkat", () => {
    it("jeda memanjang mengikuti tangga, lalu berhenti di kuota jam", async () => {
      const jeda: number[] = [];

      for (let ke = 1; ke <= MAKS_KIRIM; ke++) {
        const boleh = await prosesKirimUlang("verifikasi", EMAIL, "203.0.113.1", kirimSungguhan);
        expect(boleh.diizinkan).toBe(true);
        jeda.push(boleh.sisaDetik);

        // Percobaan tepat sesudahnya harus ditolak, dan alasannya berubah dari
        // "jeda" menjadi "kuota habis" pada kiriman terakhir.
        const ditolak = await prosesKirimUlang("verifikasi", EMAIL, "203.0.113.1", kirimSungguhan);
        expect(ditolak.diizinkan).toBe(false);

        if (ke < MAKS_KIRIM) await majuDetik(TANGGA_COOLDOWN[ke - 1] + 1);
      }

      // Empat kiriman pertama mengikuti tangga, dan jedanya memanjang.
      expect(jeda.slice(0, MAKS_KIRIM - 1)).toEqual(TANGGA_COOLDOWN.slice(0, MAKS_KIRIM - 1));

      // Kiriman TERAKHIR berbeda: kuota jendela habis, jadi jedanya bukan lagi
      // tangga melainkan tunggu sampai percobaan tertua keluar dari jendela satu
      // jam. Angkanya lebih besar dari tangga terakhir — kalau memakai tangga,
      // tombolnya akan menyala sebelum kuotanya benar-benar pulih.
      const terakhir = jeda[MAKS_KIRIM - 1];
      expect(terakhir).toBeGreaterThan(TANGGA_COOLDOWN[MAKS_KIRIM - 1]);
      expect(terakhir).toBeLessThanOrEqual(60 * 60);

      const semua = await percobaan();
      const diizinkan = semua.filter((r) => r.outcome === "diizinkan");
      expect(diizinkan).toHaveLength(MAKS_KIRIM);
      // Email hanya dikirim untuk yang diizinkan — lima, bukan sepuluh.
      expect(jumlahPermintaan).toBe(MAKS_KIRIM);

      // Penolakan terakhir sebabnya kuota, bukan sekadar jeda.
      expect(semua[semua.length - 1].outcome).toBe("ditolak_kuota");
      expect(semua.filter((r) => r.outcome === "ditolak_cooldown").length).toBe(MAKS_KIRIM - 1);
    });
  });

  // ------------------------------------------- keadaan bertahan lintas muat

  describe("keadaan bertahan saat halaman dimuat ulang", () => {
    it("status yang dibaca ulang sama dengan yang dilaporkan saat mengirim", async () => {
      const kirim = await prosesKirimUlang("verifikasi", EMAIL, null, kirimSungguhan);
      expect(kirim.diizinkan).toBe(true);

      // Ini yang dilakukan halaman saat dibuka lagi — di tab baru, perangkat
      // lain, atau setelah reload. Tidak ada state browser yang terlibat.
      const setelahMuatUlang = await statusKirim("verifikasi", EMAIL);

      expect(setelahMuatUlang.terpakai).toBe(kirim.terpakai);
      expect(setelahMuatUlang.maks).toBe(kirim.maks);
      // Sisa waktunya boleh berkurang sedikit karena waktu berjalan, tapi harus
      // tetap dalam jeda yang sama — bukan nol, dan bukan angka baru.
      expect(setelahMuatUlang.sisaDetik).toBeGreaterThan(0);
      expect(setelahMuatUlang.sisaDetik).toBeLessThanOrEqual(kirim.sisaDetik);
    });

    it("kuota yang sudah habis tetap habis setelah dimuat ulang", async () => {
      for (let ke = 1; ke <= MAKS_KIRIM; ke++) {
        await prosesKirimUlang("verifikasi", EMAIL, null, kirimSungguhan);
        if (ke < MAKS_KIRIM) await majuDetik(TANGGA_COOLDOWN[ke - 1] + 1);
      }

      const status = await statusKirim("verifikasi", EMAIL);
      expect(status.terpakai).toBe(MAKS_KIRIM);
      expect(status.sisaDetik).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------- 429 dari Resend

  describe("layanan email menjawab 429", () => {
    it("percobaannya tetap tercatat, lengkap dengan pesan galatnya", async () => {
      balas = { status: 429, body: '{"message":"Too many requests"}' };

      await expect(
        prosesKirimUlang("verifikasi", EMAIL, "198.51.100.1", kirimSungguhan),
      ).rejects.toThrow(/429/);

      // INI YANG DULU HILANG. Lemparan dari layanan email melewati pencatatan,
      // sehingga percobaan yang sudah memakan kuota tidak berjejak sama sekali.
      const rows = await percobaan();
      expect(rows).toHaveLength(1);
      expect(rows[0].outcome).toBe("diizinkan");
      expect(rows[0].email_dikirim).toBe(false);
      expect(rows[0].error_kirim).toMatch(/429/);
    });

    it("jatah dikembalikan, jadi pengguna bisa langsung mencoba lagi", async () => {
      balas = { status: 429, body: '{"message":"Too many requests"}' };
      await expect(prosesKirimUlang("verifikasi", EMAIL, null, kirimSungguhan)).rejects.toThrow();

      // Tanpa pengembalian jatah, gangguan di pihak Resend berubah menjadi
      // cooldown bagi pengguna yang tidak melakukan kesalahan apa pun.
      const status = await statusKirim("verifikasi", EMAIL);
      expect(status.terpakai).toBe(0);
      expect(status.sisaDetik).toBe(0);

      // Dan percobaan berikutnya memang langsung diizinkan.
      balas = { status: 200, body: '{"id":"mock"}' };
      const lagi = await prosesKirimUlang("verifikasi", EMAIL, null, kirimSungguhan);
      expect(lagi.diizinkan).toBe(true);
    });

    it("5xx diperlakukan sama seperti 429", async () => {
      balas = { status: 503, body: "layanan sedang tidak tersedia" };
      await expect(prosesKirimUlang("verifikasi", EMAIL, null, kirimSungguhan)).rejects.toThrow(
        /503/,
      );

      expect((await statusKirim("verifikasi", EMAIL)).terpakai).toBe(0);
    });

    it("galat PERMANEN tidak mengembalikan jatah", async () => {
      // 403 biasanya berarti domain pengirim belum terverifikasi. Mencoba ulang
      // tidak menolong, dan mengembalikan jatahnya membuka jalan menembak
      // berulang tanpa batas ke layanan yang pasti menolak.
      balas = { status: 403, body: '{"message":"domain not verified"}' };
      await expect(prosesKirimUlang("verifikasi", EMAIL, null, kirimSungguhan)).rejects.toThrow(
        /403/,
      );

      const status = await statusKirim("verifikasi", EMAIL);
      expect(status.terpakai).toBe(1);
      expect(status.sisaDetik).toBeGreaterThan(0);

      const rows = await percobaan();
      expect(rows[0].error_kirim).toMatch(/403/);
    });

    it("429 tidak dihitung sebagai email terkirim di log email", async () => {
      balas = { status: 429, body: '{"message":"Too many requests"}' };
      await expect(prosesKirimUlang("verifikasi", EMAIL, null, kirimSungguhan)).rejects.toThrow();

      const log = await run<{ status: string }>(
        "SELECT status FROM public.email_logs WHERE recipient LIKE $1",
        [`%${P}%`],
        OWNER,
      );
      expect(log).toHaveLength(1);
      expect(log[0].status).toBe("gagal");
    });
  });
});
