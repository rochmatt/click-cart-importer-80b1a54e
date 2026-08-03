import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware.server";
import { assertAdmin } from "@/lib/admin-access.server";

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
    const { error } = await createServiceClient()
      .from("store_settings")
      .update(fields)
      .eq("id", id);
    if (error) throw error;
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
    const { error } = await context.db
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw error;
    return { ok: true, message: "Role removed." };
  });
