// @vitest-environment node
//
// Penjadwalan pengumuman terhadap PostgreSQL sungguhan.
//
// announcement-window.test.ts menguji LOGIKA jendela dengan angka. Berkas ini
// menutup celah yang tidak bisa diuji dengan angka: bahwa timestamptz yang
// ditulis ke database, dengan offset zona berapa pun, KEMBALI sebagai string
// yang pengumumanTampil bisa nilai dengan benar. Kalau parser tipe berubah dan
// mengembalikan waktu tanpa offset, logika jendela tetap lulus di unit test tapi
// rusak di produksi — round-trip inilah yang menangkapnya.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pengumumanTampil } from "./announcement-window";
import { closePools, run } from "./db/pool.server";

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const P = "zzuji-jadwal-";

async function bersihkan() {
  await run("DELETE FROM public.announcements WHERE title LIKE $1", [`${P}%`], OWNER);
}

/** Menyisipkan pengumuman dengan starts_at/ends_at apa adanya (teks SQL). */
async function buat(title: string, starts: string | null, ends: string | null, aktif = true) {
  await run(
    `INSERT INTO public.announcements (title, message, kind, is_active, starts_at, ends_at)
     VALUES ($1, 'uji', 'info', $2, $3::timestamptz, $4::timestamptz)`,
    [title, aktif, starts, ends],
    OWNER,
  );
}

/** Membaca kembali starts_at/ends_at seperti yang dilihat kode aplikasi. */
async function baca(title: string) {
  const rows = await run<{ is_active: boolean; starts_at: string | null; ends_at: string | null }>(
    "SELECT is_active, starts_at, ends_at FROM public.announcements WHERE title = $1",
    [title],
    OWNER,
  );
  return rows[0];
}

describe.skipIf(!CONFIGURED)("penjadwalan pengumuman (round-trip DB)", () => {
  beforeEach(bersihkan);

  afterAll(async () => {
    await bersihkan();
    await closePools();
  });

  it("timestamptz kembali sebagai string ISO UTC ber-Z", async () => {
    await buat(`${P}z`, "2026-08-04 10:00:00+07", null);
    const row = await baca(`${P}z`);
    // 10:00 di UTC+7 = 03:00 UTC (offset +07 berarti tujuh jam DI DEPAN UTC).
    // Harus kembali sebagai instan itu, ber-Z.
    expect(row.starts_at).toMatch(/Z$/);
    expect(new Date(row.starts_at!).toISOString()).toBe("2026-08-04T03:00:00.000Z");
  });

  it("offset penulisan berbeda untuk instan sama kembali identik", async () => {
    await buat(`${P}wib`, "2026-08-04 10:00:00+07", null);
    await buat(`${P}utc`, "2026-08-04 03:00:00+00", null);
    const wib = await baca(`${P}wib`);
    const utc = await baca(`${P}utc`);
    // 10:00+07 dan 03:00+00 adalah instan yang sama.
    expect(new Date(wib.starts_at!).getTime()).toBe(new Date(utc.starts_at!).getTime());
  });

  it("belum mulai: tidak tampil", async () => {
    await buat(`${P}nanti`, "2999-01-01 00:00:00+07", null);
    const row = await baca(`${P}nanti`);
    expect(pengumumanTampil(row, Date.now())).toBe(false);
  });

  it("sudah mulai, belum berakhir: tampil", async () => {
    await buat(`${P}kini`, "2000-01-01 00:00:00+07", "2999-01-01 00:00:00+07");
    const row = await baca(`${P}kini`);
    expect(pengumumanTampil(row, Date.now())).toBe(true);
  });

  it("sudah berakhir: tidak tampil", async () => {
    await buat(`${P}lampau`, "2000-01-01 00:00:00+07", "2000-06-01 00:00:00+07");
    const row = await baca(`${P}lampau`);
    expect(pengumumanTampil(row, Date.now())).toBe(false);
  });

  it("nonaktif tidak tampil walau di dalam jendela", async () => {
    await buat(`${P}mati`, "2000-01-01 00:00:00+07", "2999-01-01 00:00:00+07", false);
    const row = await baca(`${P}mati`);
    expect(pengumumanTampil(row, Date.now())).toBe(false);
  });

  it("starts_at DEFAULT now() membuat pengumuman langsung tayang", async () => {
    // Jalur pembuatan admin memakai starts_at = sekarang. Barisnya harus
    // langsung memenuhi jendela, bukan tertahan satu tick.
    await run(
      `INSERT INTO public.announcements (title, message, kind, is_active)
       VALUES ($1, 'uji', 'info', true)`,
      [`${P}default`],
      OWNER,
    );
    const row = await baca(`${P}default`);
    expect(pengumumanTampil(row, Date.now())).toBe(true);
  });
});
