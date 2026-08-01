import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies the calling user has the `admin` role through the user-scoped
 * client (RLS + has_role), before any privileged work runs.
 */
export async function assertAdmin(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw error;
  if (data !== true) {
    throw new Response("Forbidden", { status: 403 });
  }
}
