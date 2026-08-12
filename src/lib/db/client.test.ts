// Tes lapisan kompatibel terhadap PostgreSQL sungguhan.
//
// Butuh DATABASE_URL dan DATABASE_URL_APP. Kalau belum diset, seluruh berkas
// dilewati — bukan gagal — supaya `bun run test` tetap berguna di mesin yang
// tidak punya database lokal.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServiceClient, createUserClient } from "./client.server";
import { closePools, run } from "./pool.server";

const CONFIGURED = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_APP);

const BUDI = "aaaaaaaa-0000-4000-8000-000000000001";
const SITI = "aaaaaaaa-0000-4000-8000-000000000002";
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000003";
const PREFIX = "uji-lapisan-";

const service = () => createServiceClient();

async function bersihkan() {
  await run("DELETE FROM public.orders WHERE order_number LIKE $1", [`${PREFIX}%`], { rls: false });
  await run("DELETE FROM public.admin_products WHERE title LIKE $1", [`${PREFIX}%`], {
    rls: false,
  });
  await run("DELETE FROM public.sales_events WHERE marketplace LIKE $1", [`${PREFIX}%`], {
    rls: false,
  });
  await run("DELETE FROM auth.users WHERE id = ANY($1)", [[BUDI, SITI, ADMIN]], { rls: false });
}

describe.skipIf(!CONFIGURED)("lapisan kompatibel Supabase -> PostgreSQL", () => {
  beforeAll(async () => {
    await bersihkan();
    await run(
      `INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
         ($1,'budi.uji@contoh.id',now()), ($2,'siti.uji@contoh.id',now()), ($3,'admin.uji@contoh.id',now())`,
      [BUDI, SITI, ADMIN],
      { rls: false },
    );
    await run(
      `INSERT INTO public.profiles (id, display_name) VALUES ($1,'Budi'), ($2,'Siti'), ($3,'Admin')`,
      [BUDI, SITI, ADMIN],
      { rls: false },
    );
    await run(`INSERT INTO public.user_roles (user_id, role) VALUES ($1,'admin')`, [ADMIN], {
      rls: false,
    });
  });

  afterAll(async () => {
    await bersihkan();
    await closePools();
  });

  describe("operasi dasar", () => {
    it("insert lalu select mengembalikan baris yang sama", async () => {
      const dibuat = await service()
        .from("admin_products")
        .insert({ title: `${PREFIX}kursi`, category: "Home & Living", price: 250000 })
        .select("id, title, price");

      expect(dibuat.error).toBeNull();
      expect(dibuat.data).toHaveLength(1);
      expect(dibuat.data![0].title).toBe(`${PREFIX}kursi`);
      expect(dibuat.data![0].price).toBe(250000);
    });

    it("insert tanpa select memberi data null, bukan array kosong", async () => {
      const hasil = await service()
        .from("admin_products")
        .insert({ title: `${PREFIX}meja`, price: 100 });
      expect(hasil.error).toBeNull();
      expect(hasil.data).toBeNull();
    });

    it("update dengan eq hanya menyentuh baris yang cocok", async () => {
      await service()
        .from("admin_products")
        .insert({ title: `${PREFIX}lampu`, price: 50 });
      const hasil = await service()
        .from("admin_products")
        .update({ price: 999 })
        .eq("title", `${PREFIX}lampu`)
        .select("title, price");

      expect(hasil.error).toBeNull();
      expect(hasil.data).toHaveLength(1);
      expect(hasil.data![0].price).toBe(999);
    });

    it("delete menghapus hanya yang difilter", async () => {
      await service()
        .from("admin_products")
        .insert({ title: `${PREFIX}hapus`, price: 1 });
      await service().from("admin_products").delete().eq("title", `${PREFIX}hapus`);
      const sisa = await service()
        .from("admin_products")
        .select("id")
        .eq("title", `${PREFIX}hapus`);
      expect(sisa.data).toHaveLength(0);
    });

    it("upsert onConflict memperbarui, bukan menggandakan", async () => {
      const satu = await service()
        .from("profiles")
        .upsert({ id: BUDI, display_name: "Budi Diperbarui" }, { onConflict: "id" })
        .select("id, display_name");
      expect(satu.error).toBeNull();
      expect(satu.data![0].display_name).toBe("Budi Diperbarui");

      const jumlah = await service().from("profiles").select("id").eq("id", BUDI);
      expect(jumlah.data).toHaveLength(1);
    });
  });

  describe("filter dan urutan", () => {
    beforeAll(async () => {
      await service()
        .from("admin_products")
        .insert([
          { title: `${PREFIX}alfa`, price: 300, category: "Fashion" },
          { title: `${PREFIX}beta`, price: 200, category: "Fashion" },
          { title: `${PREFIX}gama`, price: 100, category: "Beauty" },
        ]);
    });

    it("order ascending dan descending", async () => {
      const naik = await service()
        .from("admin_products")
        .select("title, price")
        .ilike("title", `${PREFIX}%`)
        .order("price", { ascending: true })
        .limit(3);
      const harga = naik.data!.map((r: { price: number }) => Number(r.price));
      expect(harga).toEqual([...harga].sort((a, b) => a - b));

      const turun = await service()
        .from("admin_products")
        .select("price")
        .ilike("title", `${PREFIX}%`)
        .order("price", { ascending: false })
        .limit(3);
      const hargaTurun = turun.data!.map((r: { price: number }) => Number(r.price));
      expect(hargaTurun).toEqual([...hargaTurun].sort((a, b) => b - a));
    });

    it("in() dengan daftar kosong mengembalikan nol baris, bukan error SQL", async () => {
      const hasil = await service().from("admin_products").select("id").in("id", []);
      expect(hasil.error).toBeNull();
      expect(hasil.data).toHaveLength(0);
    });

    it("neq dan gte", async () => {
      const hasil = await service()
        .from("admin_products")
        .select("title, price")
        .ilike("title", `${PREFIX}%`)
        .neq("category", "Beauty")
        .gte("price", 200);
      expect(hasil.error).toBeNull();
      expect(hasil.data!.every((r: { price: number }) => Number(r.price) >= 200)).toBe(true);
    });

    it("ilike tidak membedakan huruf besar-kecil", async () => {
      const hasil = await service()
        .from("admin_products")
        .select("title")
        .ilike("title", `${PREFIX.toUpperCase()}ALFA`);
      expect(hasil.data).toHaveLength(1);
    });
  });

  describe("tipe hasil menyamai PostgREST", () => {
    // Regresi untuk bug diam-diam: node-pg mengembalikan bigint/numeric sebagai
    // string dan tanggal sebagai objek Date. Kode yang menjumlahkan kolom uang
    // akan merangkai string ("0" + "150000" = "0150000") tanpa error apa pun.
    it("bigint dan numeric jadi number, bukan string", async () => {
      const hasil = await service()
        .from("admin_products")
        .insert({ title: `${PREFIX}tipe`, price: 150000, rating: 4.5 })
        .select("price, rating");

      const baris = hasil.data![0];
      expect(typeof baris.price).toBe("number");
      expect(typeof baris.rating).toBe("number");
      expect(0 + baris.price).toBe(150000);
      expect(baris.price + baris.price).toBe(300000);
    });

    it("timestamptz jadi string ISO, bukan objek Date", async () => {
      const hasil = await service()
        .from("admin_products")
        .select("created_at")
        .ilike("title", `${PREFIX}tipe`)
        .maybeSingle();

      expect(typeof hasil.data.created_at).toBe("string");
      expect(hasil.data.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("date tetap YYYY-MM-DD tanpa pergeseran zona waktu", async () => {
      await service()
        .from("sales_events")
        .insert({
          event_date: "2026-07-04",
          marketplace: `${PREFIX}mp`,
          product_ref: `${PREFIX}p`,
          revenue: 1000,
        });
      const hasil = await service()
        .from("sales_events")
        .select("event_date, revenue")
        .eq("marketplace", `${PREFIX}mp`)
        .maybeSingle();

      expect(hasil.data.event_date).toBe("2026-07-04");
      expect(typeof hasil.data.revenue).toBe("number");
    });
  });

  describe("or() sintaks PostgREST", () => {
    it("eq pada dua kolom mengembalikan yang cocok salah satunya", async () => {
      await service()
        .from("admin_products")
        .insert({ title: `${PREFIX}orA`, catalog_ref: "REF-OR-1", price: 10 });
      const hasil = await service()
        .from("admin_products")
        .select("title, catalog_ref")
        .or("catalog_ref.eq.REF-OR-1,id.eq.REF-OR-1");

      expect(hasil.error).toBeNull();
      expect(hasil.data).toHaveLength(1);
      expect(hasil.data![0].catalog_ref).toBe("REF-OR-1");
    });

    it("nilai bukan uuid pada kolom uuid tidak melempar, hanya tidak cocok", async () => {
      // Pola persis dari commerce.server.ts:142 saat productRef bukan uuid.
      // Tanpa cast ke text, PostgreSQL menolak dengan invalid input syntax.
      const hasil = await service()
        .from("admin_products")
        .select("id")
        .or("catalog_ref.eq.bukan-uuid,id.eq.bukan-uuid");
      expect(hasil.error).toBeNull();
    });

    it("ilike pada dua kolom", async () => {
      const hasil = await service()
        .from("admin_products")
        .select("title")
        .or(`title.ilike.%${PREFIX}orA%,brand.ilike.%${PREFIX}orA%`);
      expect(hasil.error).toBeNull();
      expect(hasil.data!.length).toBeGreaterThan(0);
    });

    it("digabung AND dengan filter lain, bukan menggantikannya", async () => {
      const hasil = await service()
        .from("admin_products")
        .select("title")
        .eq("title", "tidak-akan-pernah-ada")
        .or("catalog_ref.eq.REF-OR-1,id.eq.REF-OR-1");
      expect(hasil.data).toHaveLength(0);
    });

    it("operator tak dikenal ditolak sebagai error, bukan diabaikan", async () => {
      const hasil = await service().from("admin_products").select("id").or("title.gt.5");
      expect(hasil.data).toBeNull();
      expect(hasil.error?.message).toContain("tidak didukung");
    });
  });

  describe("single dan maybeSingle", () => {
    it("maybeSingle memberi null saat kosong, tanpa error", async () => {
      const hasil = await service()
        .from("admin_products")
        .select("id")
        .eq("title", "tidak-akan-pernah-ada")
        .maybeSingle();
      expect(hasil.error).toBeNull();
      expect(hasil.data).toBeNull();
    });

    it("single memberi error PGRST116 saat kosong", async () => {
      const hasil = await service()
        .from("admin_products")
        .select("id")
        .eq("title", "tidak-akan-pernah-ada")
        .single();
      expect(hasil.data).toBeNull();
      expect(hasil.error?.code).toBe("PGRST116");
    });

    it("maybeSingle memberi error saat lebih dari satu baris", async () => {
      const hasil = await service()
        .from("admin_products")
        .select("id")
        .ilike("title", `${PREFIX}%`)
        .maybeSingle();
      expect(hasil.error?.code).toBe("PGRST116");
    });
  });

  describe("keamanan", () => {
    it("nama kolom yang tidak sah ditolak, tidak dirangkai ke SQL", async () => {
      const hasil = await service()
        .from("admin_products")
        .select("id")
        .eq("id; DROP TABLE admin_products", "x");
      expect(hasil.data).toBeNull();
      expect(hasil.error?.message).toContain("tidak valid");

      // Tabelnya harus masih ada.
      const masihAda = await service().from("admin_products").select("id").limit(1);
      expect(masihAda.error).toBeNull();
    });

    it("rpc di luar daftar putih ditolak", async () => {
      const hasil = await service().rpc("pg_sleep", { _user_id: 1 });
      expect(hasil.error?.code).toBe("RPC_NOT_ALLOWED");
    });

    it("rpc has_role bekerja untuk admin dan bukan-admin", async () => {
      const admin = await service().rpc<boolean>("has_role", { _user_id: ADMIN, _role: "admin" });
      expect(admin.error).toBeNull();
      expect(admin.data).toBe(true);

      const bukan = await service().rpc<boolean>("has_role", { _user_id: BUDI, _role: "admin" });
      expect(bukan.data).toBe(false);
    });
  });

  describe("RLS", () => {
    beforeAll(async () => {
      await service()
        .from("orders")
        .insert([
          {
            order_number: `${PREFIX}budi`,
            product_name: "Pesanan Budi",
            customer_email: "budi.uji@contoh.id",
            user_id: BUDI,
            // Data pengiriman wajib (CHECK orders_*_not_blank di schema.sql).
            shipping_name: "Budi",
            shipping_phone: "08123456789",
            shipping_address: "Jl. Uji Budi No. 1",
            destination_city: "Jakarta",
          },
          {
            order_number: `${PREFIX}siti`,
            product_name: "Pesanan Siti",
            customer_email: "siti.uji@contoh.id",
            user_id: SITI,
            shipping_name: "Siti",
            shipping_phone: "08129876543",
            shipping_address: "Jl. Uji Siti No. 2",
            destination_city: "Bandung",
          },
        ]);
    });

    it("pengguna hanya melihat pesanannya sendiri", async () => {
      const budi = await createUserClient(BUDI)
        .from("orders")
        .select("order_number")
        .ilike("order_number", `${PREFIX}%`);
      expect(budi.error).toBeNull();
      expect(budi.data!.map((r: { order_number: string }) => r.order_number)).toEqual([
        `${PREFIX}budi`,
      ]);

      const siti = await createUserClient(SITI)
        .from("orders")
        .select("order_number")
        .ilike("order_number", `${PREFIX}%`);
      expect(siti.data!.map((r: { order_number: string }) => r.order_number)).toEqual([
        `${PREFIX}siti`,
      ]);
    });

    it("admin melihat semua pesanan", async () => {
      const admin = await createUserClient(ADMIN)
        .from("orders")
        .select("order_number")
        .ilike("order_number", `${PREFIX}%`);
      expect(admin.data).toHaveLength(2);
    });

    it("pengguna tidak bisa mengubah data pengguna lain", async () => {
      const hasil = await createUserClient(BUDI)
        .from("orders")
        .update({ product_name: "DIBAJAK" })
        .eq("order_number", `${PREFIX}siti`)
        .select("order_number");
      // Bukan error — RLS membuat barisnya tidak terlihat, jadi nol baris terubah.
      expect(hasil.data ?? []).toHaveLength(0);

      const cek = await service()
        .from("orders")
        .select("product_name")
        .eq("order_number", `${PREFIX}siti`)
        .single();
      expect(cek.data.product_name).toBe("Pesanan Siti");
    });

    it("klien anonim TIDAK melewati RLS", async () => {
      // Regresi untuk bug nyata: pool sempat dipilih dari ada/tidaknya userId,
      // sehingga pengunjung anonim mendarat di koneksi service yang melewati
      // RLS. Anonim harus melihat nol pesanan, bukan semuanya.
      const anon = await createUserClient(null)
        .from("orders")
        .select("order_number")
        .ilike("order_number", `${PREFIX}%`);
      expect(anon.error).toBeNull();
      expect(anon.data).toHaveLength(0);
    });

    it("klien anonim tetap bisa membaca katalog publik", async () => {
      const anon = await createUserClient(null)
        .from("admin_products")
        .select("id")
        .ilike("title", `${PREFIX}%`);
      expect(anon.error).toBeNull();
      expect(anon.data!.length).toBeGreaterThan(0);
    });

    it("klien service memang melihat semuanya", async () => {
      const semua = await service()
        .from("orders")
        .select("order_number")
        .ilike("order_number", `${PREFIX}%`);
      expect(semua.data).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------
  // Penulisan produk oleh anonim dan non-admin.
  //
  // Policy products_write memakai has_role(auth.uid(), 'admin'), sedangkan
  // products_read memakai USING (true) supaya storefront tetap terbaca
  // pengunjung. Gabungan itulah yang berbahaya kalau salah: katalog memang
  // harus terbuka untuk DIBACA, dan tabel yang terbuka untuk dibaca mudah
  // dianggap "publik" seluruhnya.
  //
  // KENAPA UJI POSITIFNYA WAJIB ADA. Tanpa pembanding admin yang BERHASIL,
  // seluruh tes di bawah akan tetap hijau seandainya query builder rusak dan
  // tidak melakukan apa pun — nol baris terubah terlihat sama persis dengan
  // ditolak RLS.
  //
  // Dulu jalur ini lewat PostgREST milik Supabase. Setelah pindah ke
  // PostgreSQL sendiri, penegakannya tetap di tempat yang sama — policy RLS —
  // hanya pemanggilnya yang berganti dari HTTP menjadi koneksi pool ber-RLS.
  // Yang diuji di sini policy-nya, jadi maksud tesnya tidak berubah.
  describe("RLS penulisan produk", () => {
    const JUDUL = `${PREFIX}produk-rls`;
    const SELUNDUPAN = `${PREFIX}selundupan`;
    const barisUji = {
      title: JUDUL,
      category: `${PREFIX}kategori`,
      description: "asli",
      images: [],
      price: 150000,
      status: "active",
      stock: 7,
    };

    /** Baris uji dibuat ulang sebelum tiap kasus, memakai klien service. */
    beforeEach(async () => {
      await run("DELETE FROM public.admin_products WHERE title IN ($1, $2)", [JUDUL, SELUNDUPAN], {
        rls: false,
      });
      await service().from("admin_products").insert(barisUji);
    });

    const bacaAsli = async () => {
      const { data } = await service()
        .from("admin_products")
        .select("id, title, price, description, status")
        .eq("title", JUDUL)
        .maybeSingle();
      return data;
    };

    it("anonim tidak bisa mengubah produk", async () => {
      const hasil = await createUserClient(null)
        .from("admin_products")
        .update({ price: 1, description: "DIBAJAK" })
        .eq("title", JUDUL)
        .select("id");

      // Bukan error: RLS menyaring barisnya, jadi UPDATE mengenai nol baris.
      // Perbedaan ini penting — kode yang hanya memeriksa error akan mengira
      // penulisannya berhasil.
      expect(hasil.error).toBeNull();
      expect(hasil.data ?? []).toHaveLength(0);

      const sesudah = await bacaAsli();
      expect(sesudah.price).toBe(150000);
      expect(sesudah.description).toBe("asli");
    });

    it("anonim tidak bisa menghapus produk", async () => {
      const hasil = await createUserClient(null)
        .from("admin_products")
        .delete()
        .eq("title", JUDUL)
        .select("id");

      expect(hasil.error).toBeNull();
      expect(hasil.data ?? []).toHaveLength(0);
      expect(await bacaAsli()).not.toBeNull();
    });

    it("pengguna biasa yang sudah masuk tidak bisa mengubah produk", async () => {
      // BUDI punya sesi sah dan baris di auth.users; yang tidak ia punya hanya
      // peran admin. Ini lebih dekat dengan penyalahgunaan nyata daripada
      // anonim — penyerang biasanya sudah punya akun.
      const hasil = await createUserClient(BUDI)
        .from("admin_products")
        .update({ price: 1, status: "draft" })
        .eq("title", JUDUL)
        .select("id");

      expect(hasil.error).toBeNull();
      expect(hasil.data ?? []).toHaveLength(0);

      const sesudah = await bacaAsli();
      expect(sesudah.price).toBe(150000);
      expect(sesudah.status).toBe("active");
    });

    it("pengguna biasa yang sudah masuk tidak bisa menghapus produk", async () => {
      const hasil = await createUserClient(BUDI)
        .from("admin_products")
        .delete()
        .eq("title", JUDUL)
        .select("id");

      expect(hasil.error).toBeNull();
      expect(hasil.data ?? []).toHaveLength(0);
      expect(await bacaAsli()).not.toBeNull();
    });

    it("anonim dan pengguna biasa tidak bisa menyisipkan produk", async () => {
      // Ditolak lewat WITH CHECK, bukan USING — jalur berbeda dari update dan
      // delete, jadi tidak ikut terbukti oleh keduanya.
      for (const siapa of [null, BUDI]) {
        await createUserClient(siapa)
          .from("admin_products")
          .insert({ ...barisUji, title: SELUNDUPAN });
      }

      const { data } = await service().from("admin_products").select("id").eq("title", SELUNDUPAN);
      expect(data ?? []).toHaveLength(0);
    });

    it("menargetkan id langsung juga tidak menembus", async () => {
      // Menutup dugaan bahwa penolakan di atas hanya akibat filter judul.
      // Penyerang yang sudah tahu uuid produk tetap tidak bisa apa-apa.
      const id = (await bacaAsli()).id as string;

      const ubah = await createUserClient(BUDI)
        .from("admin_products")
        .update({ price: 1 })
        .eq("id", id)
        .select("id");
      expect(ubah.data ?? []).toHaveLength(0);

      const hapus = await createUserClient(null)
        .from("admin_products")
        .delete()
        .eq("id", id)
        .select("id");
      expect(hapus.data ?? []).toHaveLength(0);

      expect((await bacaAsli()).price).toBe(150000);
    });

    it("anonim dan pengguna biasa TETAP bisa membaca produk", async () => {
      // Sisi lain dari policy yang sama. Kalau penolakan di atas suatu saat
      // "diperbaiki" dengan menutup tabelnya rapat-rapat, storefront ikut mati
      // — dan tes inilah yang menangkapnya.
      for (const siapa of [null, BUDI]) {
        const baca = await createUserClient(siapa)
          .from("admin_products")
          .select("title")
          .eq("title", JUDUL);
        expect(baca.error).toBeNull();
        expect(baca.data).toHaveLength(1);
      }
    });

    it("admin BISA mengubah dan menghapus — pembanding positif", async () => {
      // Tanpa kasus ini, semua tes di atas tetap hijau seandainya query builder
      // rusak dan tidak mengirim apa pun ke database.
      const ubah = await createUserClient(ADMIN)
        .from("admin_products")
        .update({ price: 99000 })
        .eq("title", JUDUL)
        .select("id");
      expect(ubah.error).toBeNull();
      expect(ubah.data).toHaveLength(1);
      expect((await bacaAsli()).price).toBe(99000);

      const hapus = await createUserClient(ADMIN)
        .from("admin_products")
        .delete()
        .eq("title", JUDUL)
        .select("id");
      expect(hapus.error).toBeNull();
      expect(hapus.data).toHaveLength(1);
      expect(await bacaAsli()).toBeNull();
    });
  });
});
