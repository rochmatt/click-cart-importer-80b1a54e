import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_product",
  title: "Get product",
  description:
    "Fetch one PasarPilih product by its id, including description, images, variations and marketplace links.",
  inputSchema: { id: z.string().trim().describe("Product id (uuid).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    // Katalog dibaca dari PostgreSQL lokal; createUserClient(null) supaya
    // policy katalog tetap yang menentukan, bukan dilewati klien service.
    // Pemeriksaan autentikasi di atas tetap lewat Supabase.
    const { createUserClient } = await import("@/lib/db/client.server");
    const katalog = createUserClient(null);
    const { data, error } = await katalog
      .from("admin_products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return { content: [{ type: "text", text: `No product found for id ${id}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { product: data },
    };
  },
});
