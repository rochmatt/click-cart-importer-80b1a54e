/**
 * Klien apa pun yang bisa memanggil fungsi database.
 *
 * Sengaja TIDAK memakai tipe SupabaseClient: setelah cutover autentikasi, yang
 * diterima fungsi ini adalah klien kompatibel yang menghadap PostgreSQL lokal.
 * Yang dibutuhkan hanya rpc(), jadi itulah yang diminta — meminta seluruh
 * permukaan Supabase akan menolak klien yang sah tanpa alasan.
 */
interface PemanggilRpc {
  rpc(
    fn: string,
    params?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Memastikan pemanggil berperan admin sebelum pekerjaan istimewa berjalan.
 *
 * Melempar Response 403, bukan mengembalikan boolean: pemanggil yang lupa
 * memeriksa nilai kembalian akan diam-diam melewati pemeriksaan, sedangkan
 * lemparan menghentikan alurnya.
 */
export async function assertAdmin(client: PemanggilRpc, userId: string): Promise<void> {
  const { data, error } = await client.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Response("Forbidden", { status: 403 });
  }
}
