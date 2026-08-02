import { z } from "zod";

export const preferencesSchema = z.object({
  language: z.enum(["id", "en"]),
  currency: z.enum(["IDR", "USD"]),
  email_promos: z.boolean(),
  email_order_updates: z.boolean(),
  email_price_drop: z.boolean(),
  whatsapp_updates: z.boolean(),
});

export type AccountPreferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: AccountPreferences = {
  language: "id",
  currency: "IDR",
  email_promos: true,
  email_order_updates: true,
  email_price_drop: false,
  whatsapp_updates: false,
};

/** Gabungkan nilai tersimpan (jsonb bebas) dengan default yang valid. */
export function parsePreferences(value: unknown): AccountPreferences {
  const merged = {
    ...DEFAULT_PREFERENCES,
    ...(typeof value === "object" && value !== null ? value : {}),
  };
  const result = preferencesSchema.safeParse(merged);
  return result.success ? result.data : DEFAULT_PREFERENCES;
}

export const profileFormSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(80, "Nama maksimal 80 karakter"),
  phone: z
    .string()
    .trim()
    .max(30, "Nomor telepon maksimal 30 karakter")
    .refine((v) => v === "" || /^[0-9+()\-\s]{8,}$/.test(v), {
      message: "Nomor telepon tidak valid (min. 8 digit)",
    }),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const passwordFormSchema = z
  .object({
    current_password: z.string().min(1, "Password saat ini wajib diisi"),
    new_password: z
      .string()
      .min(8, "Password baru minimal 8 karakter")
      .max(72, "Password baru maksimal 72 karakter")
      .regex(/[a-z]/, "Sertakan minimal satu huruf kecil")
      .regex(/[A-Z]/, "Sertakan minimal satu huruf besar")
      .regex(/[0-9]/, "Sertakan minimal satu angka"),
    confirm_password: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Konfirmasi password tidak sama",
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ["new_password"],
    message: "Password baru harus berbeda dari password saat ini",
  });

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;
