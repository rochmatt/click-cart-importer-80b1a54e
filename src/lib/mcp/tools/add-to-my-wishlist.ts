import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_to_my_wishlist",
  title: "Add to my wishlist",
  description:
    "Save a PasarPilih product to the signed-in user's wishlist. Pass a product id from search_products.",
  inputSchema: { product_id: z.string().trim().describe("Product id (uuid) to save.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: async ({ product_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    // Katalog dibaca dari PostgreSQL lokal; createUserClient(null) supaya
    // policy katalog tetap yang menentukan, bukan dilewati klien service.
    const { createUserClient } = await import("@/lib/db/client.server");
    const katalog = createUserClient(null);
    const { data: product, error: productError } = await katalog
      .from("admin_products")
      .select("id,title,price,sale_price,images")
      .eq("id", product_id)
      .maybeSingle();
    if (productError) throw new ToolError(productError.message);
    if (!product) throw new ToolError(`No product found for id ${product_id}`);

    const { error } = await supabase.from("wishlist_items").insert({
      user_id: ctx.getUserId(),
      product_ref: product.id,
      title: product.title,
      price: String(product.sale_price ?? product.price ?? ""),
      image: product.images?.[0] ?? null,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Saved "${product.title}" to your wishlist.` }],
      structuredContent: { product_ref: product.id },
    };
  },
});
