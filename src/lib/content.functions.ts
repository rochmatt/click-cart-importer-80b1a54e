import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin-access.server";
import { requireAuth } from "@/lib/auth/middleware.server";

// Pengumuman dan data analitik penjualan — dipindahkan dari browser.
//
// Keduanya tabel terakhir yang masih ditembak langsung ke Supabase dari kode
// halaman. Setelah ini tidak ada lagi kueri tabel dari browser sama sekali.

const ANNOUNCEMENT_COLUMNS =
  "id, title, message, kind, link_url, link_label, show_as_banner, priority, is_active, starts_at, ends_at, created_at";

async function anon() {
  const { createUserClient } = await import("@/lib/db/client.server");
  return createUserClient(null);
}

/**
 * Pengumuman yang sedang tayang.
 *
 * Versi Supabase mengandalkan RLS untuk menyaring jadwal dan status aktif.
 * Policy lokal hanya mengizinkan baca publik tanpa menyaring jadwal, jadi
 * penyaringannya dilakukan di sini secara eksplisit — kalau tidak, pengumuman
 * yang sudah dijadwalkan berakhir akan tetap tampil.
 */
export const fetchAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (
    await anon()
  )
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const sekarang = Date.now();
  return (data ?? []).filter((a: Record<string, unknown>) => {
    if (!a.is_active) return false;
    if (a.starts_at && new Date(a.starts_at as string).getTime() > sekarang) return false;
    if (a.ends_at && new Date(a.ends_at as string).getTime() < sekarang) return false;
    return true;
  });
});

/** Semua pengumuman, termasuk yang tidak aktif — untuk panel admin. */
export const adminListAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.db, context.userId);
    const { data, error } = await context.db
      .from("announcements")
      .select(ANNOUNCEMENT_COLUMNS)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const announcementSchema = z
  .object({
    title: z.string().trim().max(200),
    message: z.string().trim().max(2000),
    kind: z.string().trim().max(40),
    link_url: z.string().trim().max(1000),
    link_label: z.string().trim().max(120),
    show_as_banner: z.boolean(),
    priority: z.number().int().min(-1000).max(1000),
    is_active: z.boolean(),
    starts_at: z.string().max(40),
    ends_at: z.string().max(40).nullable(),
  })
  .strict();

async function db() {
  const { createServiceClient } = await import("@/lib/db/client.server");
  return createServiceClient();
}

export const adminSaveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().nullable(), payload: announcementSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    // Klien service: policy tulis lokal bergantung has_role(auth.uid()),
    // sedangkan identitas RLS belum disetel untuk klien ini. assertAdmin di
    // atas sudah menjadi gerbangnya.
    const client = await db();
    const { error } = data.id
      ? await client.from("announcements").update(data.payload).eq("id", data.id)
      : await client.from("announcements").insert(data.payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.string().uuid().parse(input))
  .handler(async ({ data: id, context }) => {
    await assertAdmin(context.db, context.userId);
    const { error } = await (await db()).from("announcements").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Data analitik penjualan sejak tanggal tertentu.
 *
 * Hanya admin: policy sales_events lokal memang membatasinya, dan panel
 * analitik satu-satunya pemakainya.
 */
export const fetchSalesEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.number().int().min(1).max(400).parse(input))
  .handler(async ({ data: days, context }) => {
    await assertAdmin(context.db, context.userId);
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));

    const { data, error } = await context.db
      .from("sales_events")
      .select("event_date, marketplace, product_ref, views, clicks, orders, revenue")
      .gte("event_date", since.toISOString().slice(0, 10))
      .order("event_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
