import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Address {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string;
  notes: string;
  is_default: boolean;
}

const COLUMNS =
  "id, label, recipient_name, phone, address_line, city, province, postal_code, notes, is_default";

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, "Label is required").max(40),
  recipient_name: z.string().trim().min(1, "Recipient name is required").max(80),
  phone: z
    .string()
    .trim()
    .min(6, "Phone number is too short")
    .max(30)
    .regex(/^[0-9+()\-\s]*$/, "Phone number contains invalid characters"),
  address_line: z.string().trim().min(5, "Address is required").max(400),
  city: z.string().trim().min(1, "City is required").max(80),
  province: z.string().trim().max(80),
  postal_code: z
    .string()
    .trim()
    .max(12)
    .regex(/^[0-9\s-]*$/, "Postal code contains invalid characters"),
  notes: z.string().trim().max(300),
  is_default: z.boolean(),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const listMyAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Address[]> => {
    const { data, error } = await context.supabase
      .from("user_addresses")
      .select(COLUMNS)
      .eq("user_id", context.userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Address[];
  });

export const saveMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addressSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const row = { ...fields, user_id: context.userId };

    let savedId = id ?? null;
    if (id) {
      const { error } = await context.supabase
        .from("user_addresses")
        .update(row)
        .eq("id", id)
        .eq("user_id", context.userId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await context.supabase
        .from("user_addresses")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      savedId = inserted.id;
    }

    if (fields.is_default && savedId) {
      const { error } = await context.supabase
        .from("user_addresses")
        .update({ is_default: false })
        .eq("user_id", context.userId)
        .neq("id", savedId);
      if (error) throw error;
    }

    return { ok: true, id: savedId };
  });

export const deleteMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_addresses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const setDefaultAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const clear = await context.supabase
      .from("user_addresses")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .neq("id", data.id);
    if (clear.error) throw clear.error;

    const { error } = await context.supabase
      .from("user_addresses")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
