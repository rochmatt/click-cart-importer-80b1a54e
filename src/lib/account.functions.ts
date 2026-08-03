import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type AccountPreferences,
  parsePreferences,
  preferencesSchema,
} from "@/lib/account-preferences";

export interface AccountProfile {
  display_name: string;
  phone: string;
  avatar_url: string;
  email: string;
  preferences: AccountPreferences;
}

export interface AccountOrder {
  order_number: string;
  product_name: string;
  quantity: number;
  status: string;
  courier: string | null;
  tracking_number: string | null;
  eta_date: string | null;
  created_at: string;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountProfile> => {
    const email = (context.claims.email as string | undefined) ?? "";
    const { data, error } = await context.supabase
      .from("profiles")
      .select("display_name, phone, avatar_url, preferences")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return {
      display_name: data?.display_name ?? "",
      phone: data?.phone ?? "",
      avatar_url: data?.avatar_url ?? "",
      email,
      preferences: parsePreferences(data?.preferences),
    };
  });

const profileSchema = z.object({
  display_name: z.string().trim().max(80, "Name is too long"),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number is too long")
    .regex(/^[0-9+()\-\s]*$/, "Phone number contains invalid characters"),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert(
      {
        id: context.userId,
        display_name: data.display_name,
        phone: data.phone,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const updateMyPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => preferencesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ id: context.userId, preferences: data }, { onConflict: "id" });
    if (error) throw error;
    return { ok: true };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountOrder[]> => {
    const email = (context.claims.email as string | undefined)?.trim().toLowerCase();
    if (!email) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number, product_name, quantity, status, courier, tracking_number, eta_date, created_at",
      )
      .ilike("customer_email", email)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as AccountOrder[];
  });

export interface OrderLineItem {
  product_name: string;
  quantity: number;
  unit_price: number | null;
  image: string | null;
  product_id: string | null;
}

export interface OrderDetail {
  order_number: string;
  status: string;
  courier: string | null;
  tracking_number: string | null;
  destination_city: string | null;
  eta_date: string | null;
  last_update: string | null;
  created_at: string;
  items: OrderLineItem[];
  subtotal: number | null;
  shipping: number;
  total: number | null;
}

const orderNumberSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9/\-_]+$/, "Order number contains invalid characters"),
});

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderNumberSchema.parse(input))
  .handler(async ({ data, context }): Promise<OrderDetail | null> => {
    const email = (context.claims.email as string | undefined)?.trim().toLowerCase();
    if (!email) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number, product_name, quantity, status, courier, tracking_number, destination_city, eta_date, last_update, created_at, customer_email",
      )
      .eq("order_number", data.orderNumber.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    if (row.customer_email.trim().toLowerCase() !== email) return null;

    // admin_products dibaca dari PostgreSQL lokal — sumber yang sama dengan
    // storefront dan panel admin. Baris pesanannya sendiri masih dari Supabase.
    const { createUserClient } = await import("@/lib/db/client.server");
    const { data: product } = await createUserClient(null)
      .from("admin_products")
      .select("id, title, price, sale_price, images")
      .ilike("title", row.product_name)
      .limit(1)
      .maybeSingle();

    const unitPrice = product ? (product.sale_price ?? product.price) : null;
    const items: OrderLineItem[] = [
      {
        product_name: row.product_name,
        quantity: row.quantity,
        unit_price: unitPrice,
        image: product?.images?.[0] ?? null,
        product_id: product?.id ?? null,
      },
    ];
    const subtotal = unitPrice === null ? null : unitPrice * row.quantity;
    const shipping = 0;

    return {
      order_number: row.order_number,
      status: row.status,
      courier: row.courier,
      tracking_number: row.tracking_number,
      destination_city: row.destination_city,
      eta_date: row.eta_date,
      last_update: row.last_update,
      created_at: row.created_at,
      items,
      subtotal,
      shipping,
      total: subtotal === null ? null : subtotal + shipping,
    };
  });
