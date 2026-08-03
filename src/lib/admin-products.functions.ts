import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware.server";
import { assertAdmin } from "@/lib/admin-access.server";

// Operasi panel admin untuk admin_products, dipindahkan dari browser.
//
// POLA OTORISASI — peran diperiksa lewat assertAdmin, penulisan memakai klien
// service yang melewati RLS. Klien service diperlukan karena policy tulis
// bergantung pada has_role(auth.uid(), 'admin') sedangkan klien service tidak
// menyetel identitas RLS; tanpa itu penulisan ditolak diam-diam dengan nol
// baris terubah.
//
// assertAdmin() melempar 403 sebelum satu baris pun tersentuh, jadi gerbangnya
// tetap ada. Yang berpindah adalah TEMPAT penegakan, bukan ada-tidaknya.
//
// PERUBAHAN PERILAKU YANG DISENGAJA: pembacaan daftar produk admin kini juga
// menuntut peran admin. Sebelumnya policy SELECT admin_products adalah
// USING (true), sehingga siapa pun dengan anon key bisa membaca produk berstatus
// draft. Storefront tidak terpengaruh — ia menyaring status = 'active' lewat
// catalog.functions.ts.

const STATUS = z.enum(["active", "draft"]);

/**
 * Whitelist kolom yang boleh ditulis, mengikuti keluaran toRow() di
 * admin-store.ts. .strict() menolak kunci tak dikenal: tanpa itu browser bisa
 * mengirim kolom sembarangan — termasuk id — dan menimpa baris lain.
 */
const rowSchema = z
  .object({
    title: z.string().max(300),
    category: z.string().max(120),
    description: z.string(),
    images: z.array(z.string()),
    price: z.number(),
    sale_price: z.number().nullable(),
    status: STATUS,
    stock: z.number(),
    variations: z.unknown(),
    links: z.unknown(),
    weight: z.string().max(120),
    dimensions: z.string().max(120),
    seo_title: z.string().max(300),
    seo_description: z.string().max(600),
    brand: z.string().max(200),
    size_options: z.array(z.string()),
    warranty_status: z.string().max(60),
    warranty_duration: z.string().max(120),
    custom_attributes: z.unknown(),
  })
  .strict();

const uuid = z.string().uuid();

async function db() {
  const { createServiceClient } = await import("@/lib/db/client.server");
  return createServiceClient();
}

/** Melempar kalau query gagal, meniru `if (error) throw error` versi Supabase. */
function lempar(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.db, context.userId);
    const { data, error } = await (
      await db()
    )
      .from("admin_products")
      .select("*")
      .order("updated_at", { ascending: false });
    lempar(error);
    return data ?? [];
  });

export const adminGetProduct = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => uuid.parse(input))
  .handler(async ({ data: id, context }) => {
    await assertAdmin(context.db, context.userId);
    const { data, error } = await (
      await db()
    )
      .from("admin_products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    lempar(error);
    return data ?? null;
  });

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: uuid.nullable(), payload: rowSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const client = await db();

    if (data.id) {
      const { data: row, error } = await client
        .from("admin_products")
        .update(data.payload)
        .eq("id", data.id)
        .select("*")
        .single();
      lempar(error);
      return row;
    }

    const { data: row, error } = await client
      .from("admin_products")
      .insert(data.payload)
      .select("*")
      .single();
    lempar(error);
    return row;
  });

export const adminDeleteProducts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.array(uuid).min(1).parse(input))
  .handler(async ({ data: ids, context }) => {
    await assertAdmin(context.db, context.userId);
    const { error } = await (await db()).from("admin_products").delete().in("id", ids);
    lempar(error);
  });

/** Menyisipkan ulang produk yang baru dihapus, dengan id aslinya, untuk fitur undo. */
export const adminRestoreProducts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .array(rowSchema.extend({ id: uuid }))
      .min(1)
      .parse(input),
  )
  .handler(async ({ data: rows, context }) => {
    await assertAdmin(context.db, context.userId);
    const { error } = await (await db()).from("admin_products").insert(rows);
    lempar(error);
  });

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(uuid).min(1), status: STATUS }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const { error } = await (
      await db()
    )
      .from("admin_products")
      .update({ status: data.status })
      .in("id", data.ids);
    lempar(error);
  });

/** Mengganti nama kategori di seluruh katalog, opsional sekaligus mengubah status. */
export const adminUpdateCategory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from: z.string().min(1).max(120),
        payload: z
          .object({ category: z.string().max(120).optional(), status: STATUS.optional() })
          .strict()
          .refine((p) => Object.keys(p).length > 0, "payload kosong"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    // ilike supaya baris lama dengan kapitalisasi berbeda ikut tergabung.
    const { error } = await (
      await db()
    )
      .from("admin_products")
      .update(data.payload)
      .ilike("category", data.from);
    lempar(error);
  });
