import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware.server";

// Keranjang, wishlist, dan pemeriksaan peran admin — dipindahkan dari browser.
//
// Ketiganya dulu menembak Supabase LANGSUNG dari browser memakai sesi di
// localStorage, tanpa pernah menyentuh server Node. Dipindahkan lebih dulu
// sebelum autentikasi diganti: kalau tidak, ketiganya mati seketika begitu
// sesi Supabase hilang dari browser.
//
// user_id diturunkan server dari sesi, bukan dikirim klien. Sebelumnya klien
// menyebutkan identitasnya sendiri di setiap insert dan hanya RLS yang
// menahannya.

const itemSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().max(400),
  image: z.string().max(1000),
  price: z.string().max(80),
  qty: z.number().int().min(1).max(999).optional(),
});

const itemsSchema = z.array(itemSchema).max(200);

export interface WishlistRow {
  product_ref: string;
  title: string;
  image: string;
  price: string;
}

/** qty wajib: kolomnya NOT NULL DEFAULT 1, jadi tidak pernah kembali kosong. */
export interface CartRow extends WishlistRow {
  qty: number;
}

export const getMyCart = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<CartRow[]> => {
    const { data, error } = await context.db
      .from("cart_items")
      .select("product_ref, title, image, price, qty")
      .eq("user_id", context.userId);
    if (error) throw error;
    return (data ?? []) as CartRow[];
  });

/**
 * Menimpa keranjang tersimpan dengan isi terkini. Hapus-lalu-sisipkan, sama
 * seperti versi browser sebelumnya — bukan diff, karena keranjang kecil dan
 * kebenaran lebih penting daripada jumlah query.
 */
export const replaceMyCart = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => itemsSchema.parse(input))
  .handler(async ({ data: items, context }) => {
    await context.db.from("cart_items").delete().eq("user_id", context.userId);
    if (items.length) {
      const { error } = await context.db.from("cart_items").insert(
        items.map((i) => ({
          user_id: context.userId,
          product_ref: i.id,
          title: i.title,
          image: i.image,
          price: i.price,
          qty: i.qty ?? 1,
        })),
      );
      if (error) throw error;
    }
    return { ok: true };
  });

export const getMyWishlist = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<WishlistRow[]> => {
    const { data, error } = await context.db
      .from("wishlist_items")
      .select("product_ref, title, image, price")
      .eq("user_id", context.userId);
    if (error) throw error;
    return (data ?? []) as WishlistRow[];
  });

export const replaceMyWishlist = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => itemsSchema.parse(input))
  .handler(async ({ data: items, context }) => {
    await context.db.from("wishlist_items").delete().eq("user_id", context.userId);
    if (items.length) {
      const { error } = await context.db.from("wishlist_items").insert(
        items.map((i) => ({
          user_id: context.userId,
          product_ref: i.id,
          title: i.title,
          image: i.image,
          price: i.price,
        })),
      );
      if (error) throw error;
    }
    return { ok: true };
  });

/**
 * Mencerminkan aturan RLS yang menjaga penulisan produk. Dulu dibaca browser
 * langsung dari user_roles; kini server yang memutuskan, sehingga peran tidak
 * lagi bisa disimpulkan dari data yang dipegang klien.
 */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data, error } = await context.db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  });
