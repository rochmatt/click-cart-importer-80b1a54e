import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware.server";
import { assertAdmin } from "@/lib/admin-access.server";
import { catatAudit, pelaku } from "@/lib/audit/log.server";

export interface AdminOrder {
  id: string;
  order_number: string;
  product_name: string;
  quantity: number;
  status: string;
  courier: string | null;
  tracking_number: string | null;
  destination_city: string | null;
  eta_date: string | null;
  last_update: string | null;
  customer_email: string;
  shipping_name: string;
  total: number;
  payment_method: string;
  created_at: string;
}

export interface AdminCustomer {
  id: string;
  display_name: string;
  phone: string;
  email: string;
  created_at: string;
  order_count: number;
  lifetime_value: number;
  last_order_at: string | null;
  is_admin: boolean;
}

export interface StoreSettings {
  id: string;
  store_name: string;
  tagline: string;
  support_email: string;
  support_phone: string;
  store_address: string;
  logo_url: string;
  shopee_link_template: string;
  tokopedia_link_template: string;
  tiktok_link_template: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

export interface StaffMember {
  user_id: string;
  role: string;
  email: string;
  display_name: string;
}

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AdminOrder[]> => {
    await assertAdmin(context.db, context.userId);
    const { data, error } = await context.db
      .from("orders")
      .select(
        "id, order_number, product_name, quantity, status, courier, tracking_number, destination_city, eta_date, last_update, customer_email, shipping_name, total, payment_method, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as AdminOrder[];
  });

const orderUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["processing", "packed", "shipped", "in transit", "delivered", "cancelled"]),
  courier: z.string().trim().max(60),
  tracking_number: z.string().trim().max(60),
  eta_date: z.string().trim().max(10),
  last_update: z.string().trim().max(200),
});

export const updateAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => orderUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const { id, ...fields } = data;

    // Keadaan SEBELUM diambil dulu. Perubahan status pesanan memicu email ke
    // pelanggan; kalau kelak email itu dipertanyakan, catatan "status diubah"
    // saja tidak menjawab apa pun — yang dicari adalah dari apa ke apa.
    const { data: sebelum } = await context.db
      .from("orders")
      .select("order_number, status, courier, tracking_number")
      .eq("id", id)
      .maybeSingle();
    const lama = sebelum as {
      order_number?: string;
      status?: string;
      courier?: string | null;
      tracking_number?: string | null;
    } | null;

    const { error } = await context.db
      .from("orders")
      .update({
        status: fields.status,
        courier: fields.courier || null,
        tracking_number: fields.tracking_number || null,
        eta_date: fields.eta_date || null,
        last_update: fields.last_update || null,
      })
      .eq("id", id);
    if (error) throw error;

    const statusBerubah = lama?.status !== fields.status;
    await catatAudit({
      ...pelaku(context),
      entity: "pesanan",
      entityId: id,
      entityLabel: lama?.order_number ?? id,
      action: statusBerubah ? "ubah_status" : "ubah",
      detail: statusBerubah
        ? `Status ${lama?.status ?? "?"} → ${fields.status}`
        : "Memperbarui kurir, resi, atau ETA",
      meta: {
        dari: {
          status: lama?.status ?? null,
          courier: lama?.courier ?? null,
          tracking_number: lama?.tracking_number ?? null,
        },
        ke: {
          status: fields.status,
          courier: fields.courier || null,
          tracking_number: fields.tracking_number || null,
        },
      },
    });

    return { ok: true };
  });

export const listAdminCustomers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AdminCustomer[]> => {
    await assertAdmin(context.db, context.userId);
    // Email dibaca dari auth.users lokal, bukan API admin Supabase — setelah
    // cutover API itu mengembalikan kosong dan seluruh email menghilang tanpa
    // error apa pun.
    const { listUsers } = await import("@/lib/auth/directory.server");

    const [{ data: profiles, error }, users, { data: orders }, { data: roles }] = await Promise.all(
      [
        context.db
          .from("profiles")
          .select("id, display_name, phone, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        listUsers(200),
        context.db.from("orders").select("customer_email, total, created_at").limit(1000),
        context.db.from("user_roles").select("user_id, role"),
      ],
    );
    if (error) throw error;

    const emailById = new Map<string, string>(users.map((u) => [u.id, u.email]));
    const adminIds = new Set(
      (roles ?? [])
        .filter((r: { role: string }) => r.role === "admin")
        .map((r: { user_id: string }) => r.user_id),
    );

    const stats = new Map<string, { count: number; value: number; last: string | null }>();
    for (const o of orders ?? []) {
      const key = (o.customer_email ?? "").trim().toLowerCase();
      if (!key) continue;
      const prev = stats.get(key) ?? { count: 0, value: 0, last: null };
      stats.set(key, {
        count: prev.count + 1,
        value: prev.value + (o.total ?? 0),
        last: !prev.last || o.created_at > prev.last ? o.created_at : prev.last,
      });
    }

    return (profiles ?? []).map((p: Record<string, string>) => {
      const email = emailById.get(p.id) ?? "";
      const s = stats.get(email.trim().toLowerCase());
      return {
        id: p.id,
        display_name: p.display_name ?? "",
        phone: p.phone ?? "",
        email,
        created_at: p.created_at,
        order_count: s?.count ?? 0,
        lifetime_value: s?.value ?? 0,
        last_order_at: s?.last ?? null,
        is_admin: adminIds.has(p.id),
      };
    });
  });

// store_settings adalah tabel pertama yang dipindahkan ke PostgreSQL lokal,
// karena satu-satunya yang tidak pernah disentuh kode browser — seluruh
// aksesnya lewat kedua server function di berkas ini.
export const getStoreSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<StoreSettings | null> => {
    const { createServiceClient } = await import("@/lib/db/client.server");
    const { data, error } = await createServiceClient()
      .from("store_settings")
      .select(
        "id, store_name, tagline, support_email, support_phone, store_address, logo_url, shopee_link_template, tokopedia_link_template, tiktok_link_template, utm_source, utm_medium, utm_campaign",
      )
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as StoreSettings) ?? null;
  },
);

const settingsSchema = z.object({
  id: z.string().uuid(),
  store_name: z.string().trim().min(1, "Store name is required").max(80),
  tagline: z.string().trim().max(160),
  support_email: z.union([z.string().trim().email().max(255), z.literal("")]),
  support_phone: z.string().trim().max(30),
  store_address: z.string().trim().max(300),
  logo_url: z.string().trim().max(500),
  shopee_link_template: z.string().trim().max(300),
  tokopedia_link_template: z.string().trim().max(300),
  tiktok_link_template: z.string().trim().max(300),
  utm_source: z.string().trim().max(60),
  utm_medium: z.string().trim().max(60),
  utm_campaign: z.string().trim().max(60),
});

export const updateStoreSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    // assertAdmin melempar 403 sebelum satu baris pun tersentuh.
    await assertAdmin(context.db, context.userId);

    // Penulisan memakai klien service yang melewati RLS. Policy tulis
    // store_settings lokal bergantung pada has_role(auth.uid(), 'admin'),
    // sedangkan user_roles lokal masih kosong — tanpa ini update ditolak
    // diam-diam dengan nol baris terubah. Aman karena assertAdmin di atas
    // sudah menjadi gerbangnya.
    const { createServiceClient } = await import("@/lib/db/client.server");
    const { id, ...fields } = data;
    const db = createServiceClient();

    const { data: sebelum } = await db
      .from("store_settings")
      .select(
        "store_name, tagline, support_email, support_phone, store_address, logo_url, shopee_link_template, tokopedia_link_template, tiktok_link_template, utm_source, utm_medium, utm_campaign",
      )
      .eq("id", id)
      .maybeSingle();

    const { error } = await db.from("store_settings").update(fields).eq("id", id);
    if (error) throw error;

    // Template tautan marketplace dan UTM ada di sini. Salah satu huruf yang
    // berubah bisa mengalihkan seluruh trafik keluar toko ke tujuan lain, dan
    // itu tidak akan terlihat dari tampilan mana pun — hanya dari catatan ini.
    const { kolomBerubah } = await import("@/lib/audit/log.server");
    const berubah = kolomBerubah(sebelum as Record<string, unknown> | null, fields);
    await catatAudit({
      ...pelaku(context),
      entity: "pengaturan",
      entityId: id,
      entityLabel: (fields as { store_name?: string }).store_name || "Pengaturan toko",
      action: "ubah",
      detail: berubah.length ? `Mengubah: ${berubah.join(", ")}` : "Menyimpan tanpa perubahan",
      meta: berubah.length
        ? Object.fromEntries(
            berubah.map((k) => [
              k,
              {
                dari: (sebelum as Record<string, unknown> | null)?.[k] ?? null,
                ke: (fields as Record<string, unknown>)[k] ?? null,
              },
            ]),
          )
        : undefined,
    });

    return { ok: true };
  });

export interface GoogleOAuthStatus {
  client_id: string;
  has_secret: boolean;
  redirect_uri: string;
  active: boolean;
}

// Status kredensial login Google untuk panel admin. Client ID BUKAN rahasia
// (muncul di URL OAuth), jadi boleh ditampilkan. Client Secret rahasia: hanya
// flag has_secret yang dikembalikan, nilainya TIDAK PERNAH keluar dari server.
export const getGoogleOAuth = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<GoogleOAuthStatus> => {
    await assertAdmin(context.db, context.userId);
    const { createServiceClient } = await import("@/lib/db/client.server");
    const { data, error } = await createServiceClient()
      .from("store_settings")
      .select("google_client_id, google_client_secret")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const client_id = ((data?.google_client_id as string | undefined) ?? "").trim();
    const has_secret = ((data?.google_client_secret as string | undefined) ?? "").trim().length > 0;
    return {
      client_id,
      has_secret,
      redirect_uri: "https://inipilihanku.com/api/auth/google/callback",
      active: client_id.length > 0 && has_secret,
    };
  });

const googleOAuthSchema = z.object({
  client_id: z.string().trim().max(300),
  // Kosong = pertahankan secret yang tersimpan (pola write-only). Non-kosong = ganti.
  client_secret: z.string().max(500),
});

export const updateGoogleOAuth = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => googleOAuthSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const { createServiceClient } = await import("@/lib/db/client.server");
    const db = createServiceClient();

    const { data: row, error: readErr } = await db
      .from("store_settings")
      .select("id, google_client_id, google_client_secret")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) throw new Error("Baris store_settings tidak ditemukan");

    const newSecret = data.client_secret.trim();
    const fields: { google_client_id: string; google_client_secret?: string } = {
      google_client_id: data.client_id.trim(),
    };
    // Hanya menulis secret bila admin mengetik nilai baru; field kosong = biarkan
    // yang lama (form tak pernah menerima secret tersimpan untuk dikirim balik).
    if (newSecret.length > 0) fields.google_client_secret = newSecret;

    const { error } = await db.from("store_settings").update(fields).eq("id", row.id);
    if (error) throw error;

    // Audit tanpa membocorkan nilai: hanya menyebut BAGIAN mana yang berubah.
    const idBerubah =
      ((row.google_client_id as string | undefined) ?? "").trim() !== data.client_id.trim();
    const bagian: string[] = [];
    if (idBerubah) bagian.push("Client ID");
    if (newSecret.length > 0) bagian.push("Client Secret");
    await catatAudit({
      ...pelaku(context),
      entity: "pengaturan",
      entityId: row.id as string,
      entityLabel: "Login Google (OAuth)",
      action: "ubah",
      detail: bagian.length ? `Memperbarui: ${bagian.join(", ")}` : "Menyimpan tanpa perubahan",
    });

    return { ok: true };
  });

export interface ApifyStatus {
  configured: boolean;
}

// Status token Apify untuk panel admin. Token RAHASIA: hanya flag `configured`
// yang dikembalikan; nilainya TIDAK PERNAH keluar dari server.
export const getApifyIntegration = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ApifyStatus> => {
    await assertAdmin(context.db, context.userId);
    const { createServiceClient } = await import("@/lib/db/client.server");
    const { data, error } = await createServiceClient()
      .from("store_settings")
      .select("apify_token")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const token = ((data?.apify_token as string | undefined) ?? "").trim();
    return { configured: token.length > 0 };
  });

const apifySchema = z.object({
  // Kosong = pertahankan token tersimpan (write-only, seperti Google secret).
  token: z.string().max(200),
});

export const updateApifyIntegration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => apifySchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const { createServiceClient } = await import("@/lib/db/client.server");
    const db = createServiceClient();

    const { data: row, error: readErr } = await db
      .from("store_settings")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) throw new Error("Baris store_settings tidak ditemukan");

    const newToken = data.token.trim();
    if (newToken.length > 0) {
      const { error } = await db
        .from("store_settings")
        .update({ apify_token: newToken })
        .eq("id", row.id);
      if (error) throw error;
    }

    await catatAudit({
      ...pelaku(context),
      entity: "pengaturan",
      entityId: row.id as string,
      entityLabel: "Integrasi Apify",
      action: "ubah",
      detail: newToken.length > 0 ? "Memperbarui token Apify" : "Menyimpan tanpa perubahan",
    });

    return { ok: true };
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<StaffMember[]> => {
    await assertAdmin(context.db, context.userId);
    // Nama tampilan datang dari profiles, bukan dari metadata pengguna: sistem
    // auth ini tidak menyimpan metadata bebas seperti Supabase.
    const { listUsers } = await import("@/lib/auth/directory.server");
    const [{ data: roles, error }, users] = await Promise.all([
      context.db.from("user_roles").select("user_id, role"),
      listUsers(200),
    ]);
    if (error) throw error;

    const emailById = new Map<string, string>(users.map((u) => [u.id, u.email]));
    const nameById = new Map<string, string>(users.map((u) => [u.id, u.displayName]));

    return (roles ?? []).map((r: { user_id: string; role: string }) => ({
      user_id: r.user_id,
      role: r.role,
      email: emailById.get(r.user_id) ?? "",
      display_name: nameById.get(r.user_id) ?? "",
    }));
  });

const grantSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  role: z.enum(["admin", "moderator", "user"]),
});

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => grantSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    await assertAdmin(context.db, context.userId);
    // Pencarian langsung ke auth.users lokal, bukan mengunduh 1000 pengguna
    // lalu menyaringnya di memori seperti versi Supabase sebelumnya.
    const { findUserByEmail } = await import("@/lib/auth/directory.server");
    const target = await findUserByEmail(data.email);
    if (!target) {
      return { ok: false, message: "No account found with that email address." };
    }
    const { error } = await context.db
      .from("user_roles")
      .insert({ user_id: target.id, role: data.role });
    if (error && !error.message.includes("duplicate")) throw error;

    // Pemberian peran adalah aksi paling berdampak di panel ini — sekali
    // diberikan, penerimanya bisa melakukan segalanya yang tercatat di audit
    // log ini. Kalau justru pemberiannya sendiri tak tercatat, jejak siapa yang
    // membuka pintu hilang tepat di titik yang paling perlu diketahui.
    await catatAudit({
      ...pelaku(context),
      entity: "pengguna",
      entityId: target.id,
      entityLabel: data.email,
      action: "tambah",
      detail: `Memberikan peran ${data.role}`,
      meta: { peran: data.role, duplikat: Boolean(error) },
    });

    return { ok: true, message: `${data.email} is now a ${data.role}.` };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ user_id: z.string().uuid(), role: z.enum(["admin", "moderator", "user"]) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    await assertAdmin(context.db, context.userId);
    if (data.user_id === context.userId && data.role === "admin") {
      return { ok: false, message: "You cannot remove your own admin role." };
    }
    // Email diambil sebelum dicabut supaya catatannya menyebut orangnya, bukan
    // uuid. Setelah pencabutan, menghubungkan uuid ke orang menuntut query lain.
    const { findUserById } = await import("@/lib/auth/directory.server");
    const target = await findUserById(data.user_id);

    const { error } = await context.db
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw error;

    await catatAudit({
      ...pelaku(context),
      entity: "pengguna",
      entityId: data.user_id,
      entityLabel: target?.email ?? data.user_id,
      action: "hapus",
      detail: `Mencabut peran ${data.role}`,
      meta: { peran: data.role },
    });

    return { ok: true, message: "Role removed." };
  });
