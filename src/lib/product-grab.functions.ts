import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-access.server";
import type { GrabbedProduct } from "@/lib/product-grab.server";

export type { GrabbedProduct };

const inputSchema = z.object({ url: z.string().trim().min(1).max(2048).url() });

export const grabProductByUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<GrabbedProduct> => {
    await assertAdmin(context.supabase, context.userId);
    const { grabProductFromUrl } = await import("@/lib/product-grab.server");
    return grabProductFromUrl(data.url);
  });
