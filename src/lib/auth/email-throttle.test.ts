// @vitest-environment node
//
// Menguji pembatas kirim-ulang email terhadap PostgreSQL sungguhan.
//
// Yang paling perlu dibuktikan bukan tangga cooldown-nya, melainkan bahwa dua
// permintaan yang datang BERSAMAAN hanya meloloskan satu. Itulah alasan
// logikanya ditaruh di fungsi database dengan SELECT ... FOR UPDATE, dan
// satu-satunya cara memastikannya adalah menjalankannya benar-benar bersamaan.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { catatKirim, statusKirim, MAKS_KIRIM, TANGGA_COOLDOWN } from "./email-throttle.server";
import { closePools, run } from "../db/pool.server";

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const P = "zzuji-throttle";
const EMAIL = `${P}@contoh.test`;

async function bersihkan() {
  await run("DELETE FROM auth.email_throttle WHERE email LIKE $1", [`%${P}%`], OWNER);
}

/** Menggeser cap waktu tersimpan mundur, mensimulasikan waktu berlalu. */
async function majuDetik(detik: number, email = EMAIL) {
  await run(
    `UPDATE auth.email_throttle
        SET attempts = (SELECT array_agg(a - make_interval(secs => $2) ORDER BY a) FROM unnest(attempts) a)
      WHERE email = $1`,
    [email.toLowerCase(), detik],
    OWNER,
  );
}

describe.skipIf(!CONFIGURED)("pembatas kirim email", () => {
  beforeEach(bersihkan);

  afterAll(async () => {
    await bersihkan();
    await closePools();
  });

  it("meloloskan yang pertama lalu menahan sesuai tangga cooldown", async () => {
    const pertama = await catatKirim("verifikasi", EMAIL);
    expect(pertama.diizinkan).toBe(true);
    expect(pertama.terpakai).toBe(1);

    const kedua = await catatKirim("verifikasi", EMAIL);
    expect(kedua.diizinkan).toBe(false);
    expect(kedua.sisaDetik).toBeGreaterThan(0);
    expect(kedua.sisaDetik).toBeLessThanOrEqual(TANGGA_COOLDOWN[0]);
    // Percobaan yang ditolak tidak menambah kuota terpakai.
    expect(kedua.terpakai).toBe(1);
  });

  it("cooldown memanjang tiap kiriman berikutnya", async () => {
    await catatKirim("verifikasi", EMAIL);

    await majuDetik(TANGGA_COOLDOWN[0] + 1);
    const kedua = await catatKirim("verifikasi", EMAIL);
    expect(kedua.diizinkan).toBe(true);

    // Sekarang menunggu tangga kedua, bukan tangga pertama lagi.
    const ditolak = await catatKirim("verifikasi", EMAIL);
    expect(ditolak.diizinkan).toBe(false);
    expect(ditolak.sisaDetik).toBeGreaterThan(TANGGA_COOLDOWN[0]);
  });

  it("berhenti di kuota jendela walau cooldown sudah lewat", async () => {
    // Digeser PERSIS sepanjang cooldown yang berlaku, bukan lebih. Menggeser
    // berlebihan akan mendorong percobaan awal keluar dari jendela satu jam,
    // dan tes berubah diam-diam menjadi menguji hal lain — kuota tidak pernah
    // terisi penuh, lalu kiriman keenam lolos dengan benar. Lima kiriman butuh
    // 60+120+300+900 = 1380 detik, jauh di dalam jendela.
    for (let i = 0; i < MAKS_KIRIM; i++) {
      const hasil = await catatKirim("verifikasi", EMAIL);
      expect(hasil.diizinkan).toBe(true);
      if (i < MAKS_KIRIM - 1) await majuDetik(TANGGA_COOLDOWN[i] + 1);
    }

    const keenam = await catatKirim("verifikasi", EMAIL);
    expect(keenam.diizinkan).toBe(false);
    expect(keenam.terpakai).toBe(MAKS_KIRIM);
    expect(keenam.sisaDetik).toBeGreaterThan(0);
  });

  it("percobaan yang keluar jendela satu jam berhenti dihitung", async () => {
    await catatKirim("verifikasi", EMAIL);
    expect((await statusKirim("verifikasi", EMAIL)).terpakai).toBe(1);

    await majuDetik(60 * 60 + 60);
    expect((await statusKirim("verifikasi", EMAIL)).terpakai).toBe(0);

    const lagi = await catatKirim("verifikasi", EMAIL);
    expect(lagi.diizinkan).toBe(true);
  });

  it("kapitalisasi email tidak melipatgandakan kuota", async () => {
    const a = await catatKirim("verifikasi", EMAIL.toUpperCase());
    expect(a.diizinkan).toBe(true);

    // Alamat yang sama dengan huruf berbeda harus memakai kuota yang sama.
    const b = await catatKirim("verifikasi", EMAIL.toLowerCase());
    expect(b.diizinkan).toBe(false);

    const baris = await run<{ n: number }>(
      "SELECT count(*)::int AS n FROM auth.email_throttle WHERE email LIKE $1",
      [`%${P}%`],
      OWNER,
    );
    expect(baris[0].n).toBe(1);
  });

  it("statusKirim tidak mencatat percobaan", async () => {
    await statusKirim("verifikasi", EMAIL);
    await statusKirim("verifikasi", EMAIL);
    expect((await statusKirim("verifikasi", EMAIL)).terpakai).toBe(0);

    // Dan yang pertama sungguhan tetap diizinkan.
    expect((await catatKirim("verifikasi", EMAIL)).diizinkan).toBe(true);
  });

  it("jenis kiriman berbeda punya kuota sendiri, di kedua arah", async () => {
    // Penting untuk pemulihan akun: orang yang kehabisan kiriman verifikasi
    // tidak boleh ikut kehilangan jalan untuk mereset passwordnya, dan
    // sebaliknya.
    await catatKirim("verifikasi", EMAIL);
    expect((await catatKirim("verifikasi", EMAIL)).diizinkan).toBe(false);
    expect((await catatKirim("reset", EMAIL)).diizinkan).toBe(true);

    // Kuota reset yang terpakai juga tidak mengurangi sisa kuota verifikasi.
    expect((await statusKirim("verifikasi", EMAIL)).terpakai).toBe(1);
    expect((await statusKirim("reset", EMAIL)).terpakai).toBe(1);
  });

  it("dua permintaan bersamaan hanya meloloskan satu", async () => {
    // Inti dari memindahkan logika ke fungsi database. Tanpa kunci baris,
    // keduanya membaca "belum ada percobaan" lalu sama-sama mengirim email.
    const hasil = await Promise.all([
      catatKirim("verifikasi", EMAIL),
      catatKirim("verifikasi", EMAIL),
      catatKirim("verifikasi", EMAIL),
      catatKirim("verifikasi", EMAIL),
      catatKirim("verifikasi", EMAIL),
    ]);

    expect(hasil.filter((h) => h.diizinkan)).toHaveLength(1);

    const baris = await run<{ n: number }>(
      "SELECT COALESCE(array_length(attempts, 1), 0)::int AS n FROM auth.email_throttle WHERE email = $1",
      [EMAIL.toLowerCase()],
      OWNER,
    );
    expect(baris[0].n).toBe(1);
  });
});
