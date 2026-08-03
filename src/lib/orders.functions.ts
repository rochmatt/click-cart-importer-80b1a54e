import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const lookupSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(3, "Order number is too short")
    .max(40, "Order number is too long")
    .regex(/^[A-Za-z0-9/\-_]+$/, "Order number contains invalid characters"),
  email: z
    .string()
    .trim()
    .max(255, "Email is too long")
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type NotifyLevel = "all" | "shipped_only" | "none";

export type OrderLookupResult =
  | { found: false; reason?: "email_mismatch" }
  | {
      found: true;
      order: {
        order_number: string;
        product_name: string;
        quantity: number;
        status: string;
        courier: string | null;
        tracking_number: string | null;
        destination_city: string | null;
        eta_date: string | null;
        last_update: string | null;
        notify_status_updates: boolean;
        notify_level: NotifyLevel;
      };
      /** True when the lookup was verified with the checkout email. */
      verified: boolean;
    };

export const lookupOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => lookupSchema.parse(input))
  .handler(async ({ data }): Promise<OrderLookupResult> => {
    // Klien PostgreSQL lokal yang melewati RLS, setara service_role dulu.
    const { createServiceClient } = await import("@/lib/db/client.server");
    const db = createServiceClient();

    const columns =
      "order_number, product_name, quantity, status, courier, tracking_number, destination_city, eta_date, last_update, notify_status_updates, notify_level, customer_email";
    const term = data.orderNumber.toUpperCase();

    const exact = await db.from("orders").select(columns).eq("order_number", term).maybeSingle();

    let row = exact.data as (Record<string, unknown> & { customer_email: string }) | null;

    if (!row) {
      const partial = await db
        .from("orders")
        .select(columns)
        .ilike("order_number", `%${term}%`)
        .limit(1)
        .maybeSingle();
      row = partial.data as typeof row;
    }

    if (!row) return { found: false };

    const emailMatches =
      Boolean(data.email) && row.customer_email.trim().toLowerCase() === data.email!.toLowerCase();

    if (data.email && !emailMatches) {
      return { found: false, reason: "email_mismatch" };
    }

    const { customer_email: _omit, ...order } = row;
    return {
      found: true,
      verified: emailMatches,
      order: order as Extract<OrderLookupResult, { found: true }>["order"],
    };
  });

const preferenceSchema = lookupSchema.extend({
  email: z.string().trim().max(255).email("Enter a valid email address"),
  enabled: z.boolean(),
});

export type NotifyPreferenceResult =
  { ok: true; enabled: boolean } | { ok: false; reason: "not_found" | "email_mismatch" };

/**
 * Turns order-status email updates on or off for a single order.
 * Requires the checkout email to match, so only the customer can change it.
 */
export const setOrderNotifyPreference = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => preferenceSchema.parse(input))
  .handler(async ({ data }): Promise<NotifyPreferenceResult> => {
    // Klien PostgreSQL lokal yang melewati RLS, setara service_role dulu.
    const { createServiceClient } = await import("@/lib/db/client.server");
    const db = createServiceClient();

    const { data: row } = await db
      .from("orders")
      .select("id, customer_email")
      .eq("order_number", data.orderNumber.toUpperCase())
      .maybeSingle();

    if (!row) return { ok: false, reason: "not_found" };
    if (row.customer_email.trim().toLowerCase() !== data.email.toLowerCase()) {
      return { ok: false, reason: "email_mismatch" };
    }

    const { error } = await db
      .from("orders")
      .update({
        notify_status_updates: data.enabled,
        notify_level: data.enabled ? "all" : "none",
        notify_updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) throw error;
    return { ok: true, enabled: data.enabled };
  });

const levelSchema = lookupSchema.extend({
  email: z.string().trim().max(255).email("Enter a valid email address"),
  level: z.enum(["all", "shipped_only", "none"]),
});

export type NotifyLevelResult =
  { ok: true; level: NotifyLevel } | { ok: false; reason: "not_found" | "email_mismatch" };

/**
 * Sets how much order-status email a customer wants for one order.
 * Requires the checkout email to match.
 */
export const setOrderNotifyLevel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => levelSchema.parse(input))
  .handler(async ({ data }): Promise<NotifyLevelResult> => {
    // Klien PostgreSQL lokal yang melewati RLS, setara service_role dulu.
    const { createServiceClient } = await import("@/lib/db/client.server");
    const db = createServiceClient();

    const { data: row } = await db
      .from("orders")
      .select("id, customer_email")
      .eq("order_number", data.orderNumber.toUpperCase())
      .maybeSingle();

    if (!row) return { ok: false, reason: "not_found" };
    if (row.customer_email.trim().toLowerCase() !== data.email.toLowerCase()) {
      return { ok: false, reason: "email_mismatch" };
    }

    const { error } = await db
      .from("orders")
      .update({
        notify_level: data.level,
        notify_status_updates: data.level !== "none",
        notify_updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) throw error;
    return { ok: true, level: data.level };
  });
