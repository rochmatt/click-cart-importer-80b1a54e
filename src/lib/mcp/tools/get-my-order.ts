import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_order",
  title: "Get my order",
  description:
    "Fetch one of the signed-in user's orders by order number, including its line items and shipping details.",
  inputSchema: {
    order_number: z.string().trim().describe("Order number, e.g. PP-00123."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_number }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_number", order_number)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!order) {
      return {
        content: [{ type: "text", text: `No order ${order_number} found for this account` }],
        isError: true,
      };
    }
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("title,product_ref,unit_price,quantity,line_total")
      .eq("order_id", order.id);
    if (itemsError) {
      return { content: [{ type: "text", text: itemsError.message }], isError: true };
    }
    const payload = { order, items: items ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
