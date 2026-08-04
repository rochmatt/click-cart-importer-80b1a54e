// @vitest-environment node
//
// Analytics view produk terhadap PostgreSQL sungguhan.
//
// Yang diuji: UPSERT penghitung benar-benar menambah (bukan menimpa), dan
// jendela tanggal readout menyaring seperti yang dilihat admin. Keduanya mudah
// rusak diam-diam — off-by-one pada rentang, atau ON CONFLICT yang menyetel
// alih-alih menambah, tidak akan terlihat sampai angkanya sudah salah lama.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePools, run } from "./db/pool.server";

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const P = "zzuji-view-";

async function bersihkan() {
  await run("DELETE FROM public.product_view_stats WHERE product_ref LIKE $1", [`${P}%`], OWNER);
}

/** Menyisipkan view pada hari relatif terhadap hari ini (WIB), untuk uji rentang. */
async function viewHariKe(ref: string, offsetHari: number, jumlah: number) {
  await run(
    `INSERT INTO public.product_view_stats (product_ref, view_date, views)
     VALUES ($1, (now() AT TIME ZONE 'Asia/Jakarta')::date - $2::int, $3)
     ON CONFLICT (product_ref, view_date) DO UPDATE SET views = product_view_stats.views + EXCLUDED.views`,
    [ref, offsetHari, jumlah],
    OWNER,
  );
}

/** Query readout yang PERSIS dipakai adminTopViewedProducts. */
async function topViewed(days: number) {
  return run<{ product_ref: string; views: number }>(
    `SELECT product_ref, SUM(views)::int AS views
       FROM public.product_view_stats
      WHERE view_date >= (now() AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1)
        AND product_ref LIKE $2
      GROUP BY product_ref
      ORDER BY views DESC`,
    [days, `${P}%`],
    OWNER,
  );
}

describe.skipIf(!CONFIGURED)("analytics view produk", () => {
  beforeEach(bersihkan);

  afterAll(async () => {
    await bersihkan();
    await closePools();
  });

  it("catat_view_produk MENAMBAH, bukan menimpa", async () => {
    const ref = `${P}tambah`;
    await run("SELECT public.catat_view_produk($1)", [ref], OWNER);
    await run("SELECT public.catat_view_produk($1)", [ref], OWNER);
    await run("SELECT public.catat_view_produk($1)", [ref], OWNER);

    const rows = await run<{ views: number }>(
      "SELECT views FROM public.product_view_stats WHERE product_ref = $1",
      [ref],
      OWNER,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].views).toBe(3);
  });

  it("view hari berbeda menjadi baris berbeda, dijumlahkan di readout", async () => {
    const ref = `${P}duahari`;
    await viewHariKe(ref, 0, 2);
    await viewHariKe(ref, 1, 5);

    const baris = await run<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.product_view_stats WHERE product_ref = $1",
      [ref],
      OWNER,
    );
    expect(baris[0].n).toBe(2); // dua tanggal, dua baris

    const top = await topViewed(7);
    expect(top.find((r) => r.product_ref === ref)?.views).toBe(7); // dijumlahkan
  });

  it("jendela tanggal menyaring view yang lebih tua dari rentang", async () => {
    await viewHariKe(`${P}baru`, 1, 10); // kemarin — masuk semua rentang
    await viewHariKe(`${P}lama`, 40, 99); // 40 hari lalu — di luar 7/14/30

    for (const days of [7, 14, 30]) {
      const top = await topViewed(days);
      const refs = top.map((r) => r.product_ref);
      expect(refs).toContain(`${P}baru`);
      expect(refs).not.toContain(`${P}lama`);
    }
  });

  it("batas rentang inklusif: view tepat pada hari terjauh masih terhitung", async () => {
    // Rentang 7 hari mencakup hari ini plus 6 hari sebelumnya (offset 0..6).
    // Off-by-one di sini akan membuang atau menyertakan satu hari secara keliru.
    await viewHariKe(`${P}tepi`, 6, 3);
    const masuk = await topViewed(7);
    expect(masuk.find((r) => r.product_ref === `${P}tepi`)?.views).toBe(3);

    await bersihkan();
    await viewHariKe(`${P}luar`, 7, 3); // satu hari di luar
    const keluar = await topViewed(7);
    expect(keluar.find((r) => r.product_ref === `${P}luar`)).toBeUndefined();
  });

  it("diurutkan dari paling banyak dilihat", async () => {
    await viewHariKe(`${P}a`, 0, 1);
    await viewHariKe(`${P}b`, 0, 9);
    await viewHariKe(`${P}c`, 0, 4);
    const top = await topViewed(7);
    expect(top.map((r) => r.product_ref)).toEqual([`${P}b`, `${P}c`, `${P}a`]);
  });
});
