import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the PasarPilih catalog by keyword, category, or brand. Returns matching products with price and stock.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .optional()
      .describe("Keyword matched against product title and brand."),
    category: z.string().trim().optional().describe("Category slug or name filter."),
    limit: z.number().int().optional().describe("Max results, default 20, max 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    // Katalog dibaca dari PostgreSQL lokal; createUserClient(null) supaya policy
    // katalog tetap yang menentukan. Pemeriksaan autentikasi di atas tetap
    // lewat Supabase.
    const { createUserClient } = await import("@/lib/db/client.server");
    let builder = createUserClient(null)
      .from("admin_products")
      .select("id,title,brand,category,price,sale_price,status,stock,rating,reviews")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 50));

    if (query) builder = builder.or(`title.ilike.%${query}%,brand.ilike.%${query}%`);
    if (category) builder = builder.ilike("category", `%${category}%`);

    const { data, error } = await builder;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
