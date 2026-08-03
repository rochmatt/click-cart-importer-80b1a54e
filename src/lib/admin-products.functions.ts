import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware.server";
import { assertAdmin } from "@/lib/admin-access.server";
import { catatAudit, catatAuditBanyak, kolomBerubah } from "@/lib/audit/log.server";

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

/** Identitas pelaku untuk audit log, diambil dari sesi — bukan dari kiriman klien. */
function pelaku(context: { userId: string; claims: Record<string, unknown> }) {
  return {
    actorId: context.userId,
    actorEmail: (context.claims.email as string | undefined) ?? "(tanpa email)",
  };
}

/** Batas panjang nilai yang disimpan di meta audit. */
const MAKS_NILAI = 200;

function potong(nilai: unknown): unknown {
  if (typeof nilai !== "string") return nilai;
  return nilai.length > MAKS_NILAI ? `${nilai.slice(0, MAKS_NILAI)}…` : nilai;
}

/**
 * Menyimpan nilai sebelum dan sesudah untuk kolom yang berubah saja.
 *
 * description dan images sengaja dibuang: keduanya bisa puluhan kilobyte, dan
 * menyimpan seluruh isinya di setiap penyuntingan akan membuat tabel audit
 * tumbuh jauh lebih cepat daripada tabel yang diawasinya. Fakta "description
 * berubah" tetap tercatat di kolom detail.
 */
function ringkasPerubahan(
  sebelum: Record<string, unknown> | null,
  sesudah: Record<string, unknown>,
  berubah: string[],
): Record<string, { dari: unknown; ke: unknown }> | undefined {
  if (!sebelum || !berubah.length) return undefined;
  const besar = new Set(["description", "images", "variations", "custom_attributes", "links"]);
  const hasil: Record<string, { dari: unknown; ke: unknown }> = {};
  for (const k of berubah) {
    if (besar.has(k)) continue;
    hasil[k] = { dari: potong(sebelum[k]), ke: potong(sesudah[k]) };
  }
  return Object.keys(hasil).length ? hasil : undefined;
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
    const aktor = pelaku(context);

    if (data.id) {
      // Baris lama diambil dulu supaya audit bisa menyebut kolom APA yang
      // berubah, bukan sekadar "produk diubah". Tanpa ini catatannya benar tapi
      // tidak berguna saat menelusuri siapa yang menurunkan harga.
      const { data: sebelum } = await client
        .from("admin_products")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();

      const { data: row, error } = await client
        .from("admin_products")
        .update(data.payload)
        .eq("id", data.id)
        .select("*")
        .single();
      lempar(error);

      const berubah = kolomBerubah(sebelum as Record<string, unknown> | null, data.payload);
      await catatAudit({
        ...aktor,
        entity: "produk",
        entityId: data.id,
        entityLabel: data.payload.title,
        action: "ubah",
        detail: berubah.length ? `Mengubah: ${berubah.join(", ")}` : "Menyimpan tanpa perubahan",
        meta: ringkasPerubahan(sebelum as Record<string, unknown> | null, data.payload, berubah),
      });
      return row;
    }

    const { data: row, error } = await client
      .from("admin_products")
      .insert(data.payload)
      .select("*")
      .single();
    lempar(error);

    await catatAudit({
      ...aktor,
      entity: "produk",
      entityId: (row as { id?: string } | null)?.id ?? null,
      entityLabel: data.payload.title,
      action: "tambah",
      detail: `Menambahkan produk baru di kategori ${data.payload.category || "-"}`,
    });
    return row;
  });

export const adminDeleteProducts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.array(uuid).min(1).parse(input))
  .handler(async ({ data: ids, context }) => {
    await assertAdmin(context.db, context.userId);
    const client = await db();

    // Judul diambil SEBELUM dihapus. Setelah baris hilang, satu-satunya yang
    // tersisa adalah uuid — dan audit log berisi uuid tanpa nama tidak
    // menjawab pertanyaan yang orang ajukan ke audit log.
    const { data: rows } = await client.from("admin_products").select("id, title").in("id", ids);
    const judul = new Map(
      ((rows ?? []) as { id: string; title: string }[]).map((r) => [r.id, r.title]),
    );

    const { error } = await client.from("admin_products").delete().in("id", ids);
    lempar(error);

    const aktor = pelaku(context);
    await catatAuditBanyak(
      ids.map((id) => ({
        ...aktor,
        entity: "produk" as const,
        entityId: id,
        entityLabel: judul.get(id) ?? "(produk terhapus)",
        action: "hapus" as const,
        detail:
          ids.length > 1 ? `Bagian dari penghapusan ${ids.length} produk` : "Menghapus produk",
      })),
    );
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

    const aktor = pelaku(context);
    await catatAuditBanyak(
      rows.map((r) => ({
        ...aktor,
        entity: "produk" as const,
        entityId: r.id,
        entityLabel: r.title,
        action: "pulihkan" as const,
        detail: "Membatalkan penghapusan",
      })),
    );
  });

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(uuid).min(1), status: STATUS }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const client = await db();

    const { data: rows } = await client
      .from("admin_products")
      .select("id, title, status")
      .in("id", data.ids);
    const sebelum = new Map(
      ((rows ?? []) as { id: string; title: string; status: string }[]).map((r) => [
        r.id,
        { title: r.title, status: r.status },
      ]),
    );

    const { error } = await client
      .from("admin_products")
      .update({ status: data.status })
      .in("id", data.ids);
    lempar(error);

    const aktor = pelaku(context);
    await catatAuditBanyak(
      data.ids
        // Produk yang statusnya sudah sama tidak dicatat. Menyimpan "mengubah
        // status dari active ke active" hanya menumpuk kebisingan yang membuat
        // perubahan sungguhan lebih sulit ditemukan.
        .filter((id) => sebelum.get(id)?.status !== data.status)
        .map((id) => ({
          ...aktor,
          entity: "produk" as const,
          entityId: id,
          entityLabel: sebelum.get(id)?.title ?? "(tanpa judul)",
          action: "ubah_status" as const,
          detail: `Status ${sebelum.get(id)?.status ?? "?"} → ${data.status}`,
          meta: { dari: sebelum.get(id)?.status ?? null, ke: data.status },
        })),
    );
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
    const client = await db();

    const { data: terdampak } = await client
      .from("admin_products")
      .select("id")
      .ilike("category", data.from);

    // ilike supaya baris lama dengan kapitalisasi berbeda ikut tergabung.
    const { error } = await client
      .from("admin_products")
      .update(data.payload)
      .ilike("category", data.from);
    lempar(error);

    const bagian: string[] = [];
    if (data.payload.category) bagian.push(`nama → ${data.payload.category}`);
    if (data.payload.status) bagian.push(`status → ${data.payload.status}`);

    await catatAudit({
      ...pelaku(context),
      entity: "kategori",
      entityId: null,
      entityLabel: data.from,
      action: "ubah",
      detail: `${bagian.join(", ")} (${terdampak?.length ?? 0} produk)`,
      meta: { dari: data.from, ...data.payload, jumlah_produk: terdampak?.length ?? 0 },
    });
  });
