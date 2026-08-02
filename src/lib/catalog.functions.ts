import { createServerFn } from "@tanstack/react-start";

// Pembacaan katalog yang dulu ditembak langsung dari browser ke Supabase.
//
// KENAPA DIPINDAH KE SERVER: lapisan PostgreSQL lokal server-only — ia membuka
// koneksi TCP dan membaca DATABASE_URL, jadi tidak mungkin dipakai dari kode
// browser. Selama browser masih menembak Supabase langsung, tabel admin_products
// tidak bisa dipindahkan sama sekali: sisi server membaca lokal sementara sisi
// browser membaca Supabase, dan keduanya berbeda begitu ada perubahan data.
//
// Semua fungsi di sini memakai createUserClient(null), bukan createServiceClient.
// Datanya memang publik, tapi lewat klien yang TUNDUK RLS policy katalog tetap
// yang menentukan apa yang boleh terbaca. Kalau suatu saat policy diperketat,
// query ini ikut mematuhinya — bukan diam-diam melewatinya.

/** Kolom yang dibutuhkan storefront. Sama persis dengan versi Supabase sebelumnya. */
const COLUMNS =
  "id, catalog_ref, title, category, description, images, price, sale_price, stock, rating, reviews, brand, weight, dimensions, warranty_status, warranty_duration, custom_attributes, links";

async function katalogClient() {
  const { createUserClient } = await import("@/lib/db/client.server");
  return createUserClient(null);
}

export const fetchCatalogRows = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (
    await katalogClient()
  )
    .from("admin_products")
    .select(COLUMNS)
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const fetchStockRows = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (
    await katalogClient()
  )
    .from("admin_products")
    .select("id, catalog_ref, stock")
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const fetchImageOverrideRows = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (
    await katalogClient()
  )
    .from("admin_products")
    .select("catalog_ref, images")
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return data ?? [];
});

/**
 * Dipakai loader /products/$id untuk memastikan id yang tidak ada di seed
 * katalog benar-benar ada sebagai produk admin — kalau tidak, halaman harus 404
 * alih-alih merender kosong.
 */
export const productExists = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const id = typeof input === "string" ? input : String((input as { id?: unknown })?.id ?? "");
    if (!id) throw new Error("id produk wajib diisi");
    return id;
  })
  .handler(async ({ data: id }) => {
    // Kolom pencarian ditentukan bentuk id: uuid berarti kolom id, selain itu
    // catalog_ref. Membandingkan nilai bukan-uuid ke kolom uuid membuat
    // PostgreSQL menolak query, bukan sekadar tidak menemukan baris.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const { data, error } = await (
      await katalogClient()
    )
      .from("admin_products")
      .select("id")
      .eq("status", "active")
      .eq(isUuid ? "id" : "catalog_ref", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  });
