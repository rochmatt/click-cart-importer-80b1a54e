// @vitest-environment node
//
// Menguji operasi tulis panel admin terhadap PostgreSQL sungguhan.
//
// LATAR BELAKANG: versi sekali-pakai dari tes ini pernah MERUSAK data nyata.
// updateCategory diuji dengan pola ilike "home & LIVING", yang cocok dengan dua
// produk asli dan mengganti kategorinya. Kerusakan itu lolos karena
// pemeriksaannya hanya menghitung JUMLAH baris — jumlahnya memang tidak
// berubah, isinya yang berubah.
//
// Dua pelajaran itu dikunci di sini: setiap tes memakai kategori dan judul
// berpenanda unik, dan penjagaannya membandingkan ISI baris asli sebelum dan
// sesudah, bukan sekadar jumlahnya.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServiceClient } from "./db/client.server";
import { closePools, run } from "./db/pool.server";

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const P = "ZZUJI-ADM-";
const KATEGORI_UJI = `${P}Kategori`;

const db = () => createServiceClient();

/** Sidik jari isi seluruh produk non-uji; dipakai membuktikan tak ada yang tersentuh. */
async function sidikJariProdukAsli(): Promise<string> {
  const rows = await run<{ sidik: string }>(
    `SELECT coalesce(string_agg(id || '|' || title || '|' || category || '|' || price || '|' || status, ',' ORDER BY id), '') AS sidik
       FROM admin_products WHERE title NOT LIKE $1`,
    [`${P}%`],
    OWNER,
  );
  return rows[0].sidik;
}

async function bersihkan() {
  await run("DELETE FROM admin_products WHERE title LIKE $1", [`${P}%`], OWNER);
}

const payload = {
  title: `${P}kursi`,
  category: KATEGORI_UJI,
  description: "uji",
  images: [],
  price: 250000,
  sale_price: null,
  status: "draft",
  stock: 5,
  variations: [],
  links: { shopee: "", tokopedia: "", tiktok: "" },
  weight: "1kg",
  dimensions: "10x10",
  seo_title: "",
  seo_description: "",
  brand: "UjiBrand",
  size_options: [],
  warranty_status: "none",
  warranty_duration: "",
  custom_attributes: [],
};

describe.skipIf(!CONFIGURED)("operasi tulis produk admin", () => {
  let sidikAwal = "";

  beforeAll(async () => {
    await bersihkan();
    sidikAwal = await sidikJariProdukAsli();
    expect(sidikAwal.length).toBeGreaterThan(0);
  });

  beforeEach(bersihkan);

  afterAll(async () => {
    await bersihkan();
    // Penjagaan utama: isi produk asli harus sama persis seperti sebelum tes.
    expect(await sidikJariProdukAsli()).toBe(sidikAwal);
    await closePools();
  });

  it("insert lalu select mengembalikan baris yang tersimpan", async () => {
    const hasil = await db().from("admin_products").insert(payload).select("*").single();
    expect(hasil.error).toBeNull();
    expect(hasil.data.title).toBe(`${P}kursi`);
    expect(hasil.data.price).toBe(250000);
  });

  it("update dengan eq hanya menyentuh baris yang cocok", async () => {
    const dibuat = await db().from("admin_products").insert(payload).select("id").single();
    const hasil = await db()
      .from("admin_products")
      .update({ price: 300000 })
      .eq("id", dibuat.data.id)
      .select("price")
      .single();
    expect(hasil.data.price).toBe(300000);
  });

  it("setStatus lewat in() mengubah beberapa baris sekaligus", async () => {
    const a = await db().from("admin_products").insert(payload).select("id").single();
    const b = await db()
      .from("admin_products")
      .insert({ ...payload, title: `${P}meja` })
      .select("id")
      .single();

    await db().from("admin_products").update({ status: "active" }).in("id", [a.data.id, b.data.id]);

    const cek = await db().from("admin_products").select("status").ilike("title", `${P}%`);
    expect(cek.data.every((r: { status: string }) => r.status === "active")).toBe(true);
  });

  it("updateCategory ilike TIDAK ikut mengubah produk di luar kategori uji", async () => {
    // Ini regresi dari kerusakan nyata: pola ilike yang terlalu luas mengubah
    // kategori produk asli. Kategori uji sengaja berpenanda unik.
    await db().from("admin_products").insert(payload);
    const sebelum = await sidikJariProdukAsli();

    await db()
      .from("admin_products")
      .update({ category: `${P}Baru` })
      .ilike("category", KATEGORI_UJI.toUpperCase());

    const cek = await db().from("admin_products").select("category").ilike("title", `${P}%`);
    expect(cek.data[0].category).toBe(`${P}Baru`);
    expect(await sidikJariProdukAsli()).toBe(sebelum);
  });

  it("delete lalu restore dengan id asli", async () => {
    const dibuat = await db().from("admin_products").insert(payload).select("id").single();
    const id = dibuat.data.id;

    await db().from("admin_products").delete().in("id", [id]);
    expect((await db().from("admin_products").select("id").eq("id", id)).data).toHaveLength(0);

    await db()
      .from("admin_products")
      .insert([{ id, ...payload }]);
    expect((await db().from("admin_products").select("id").eq("id", id)).data).toHaveLength(1);
  });
});
