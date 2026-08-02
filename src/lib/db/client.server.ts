// Klien berbentuk API Supabase di atas PostgreSQL lokal.
//
// Tujuannya membuat 73 pemanggilan query yang sudah ada tetap jalan tanpa
// diubah — cukup ganti barisan import-nya.
//
//   const supabase = createUserClient(userId);       // tunduk RLS
//   const supabaseAdmin = createServiceClient();     // melewati RLS
//
// PILIH YANG MANA: pakai createUserClient untuk apa pun yang dipicu permintaan
// pengguna. createServiceClient hanya untuk tugas sistem yang memang perlu
// lintas pengguna (hook email pesanan, laporan admin). Salah pilih di sini
// menghapus seluruh perlindungan RLS, jadi jangan jadikan service sebagai
// pilihan default.

import { run } from "./pool.server";
import { QueryBuilder, type Result } from "./query-builder.server";

export type { Result, PostgrestError } from "./query-builder.server";

/** Fungsi database yang boleh dipanggil lewat rpc(), beserta urutan argumennya. */
const RPC: Record<string, { sql: string; args: string[] }> = {
  has_role: {
    sql: "SELECT public.has_role($1, $2::public.app_role) AS result",
    args: ["_user_id", "_role"],
  },
};

export interface DbClient {
  from<T = any>(table: string): QueryBuilder<T>;
  rpc<T = any>(fn: string, params?: Record<string, unknown>): Promise<Result<T>>;
}

function createClient(access: { rls: boolean; userId: string | null }): DbClient {
  return {
    from<T = any>(table: string) {
      return new QueryBuilder<T>(table, access);
    },

    async rpc<T = any>(fn: string, params: Record<string, unknown> = {}): Promise<Result<T>> {
      const definition = RPC[fn];
      if (!definition) {
        // Daftar putih, bukan perangkaian nama fungsi ke SQL. Nama fungsi tidak
        // bisa diparameterkan, jadi menerima sembarang nama berarti membuka
        // pemanggilan fungsi apa pun di database.
        return {
          data: null,
          error: {
            message: `Fungsi rpc tidak terdaftar: ${fn}`,
            code: "RPC_NOT_ALLOWED",
            details: null,
          },
        };
      }

      try {
        const values = definition.args.map((name) => params[name] ?? null);
        const rows = await run<{ result: T }>(definition.sql, values, {
          rls: access.rls,
          userId: access.userId,
        });
        return { data: (rows[0]?.result ?? null) as T, error: null };
      } catch (error) {
        const e = error as { message?: string; code?: string; detail?: string };
        return {
          data: null,
          error: {
            message: e?.message ?? String(error),
            code: e?.code ?? "UNKNOWN",
            details: e?.detail ?? null,
          },
        };
      }
    },
  };
}

/** Melewati RLS. Hanya untuk operasi sistem/admin. Setara service_role Supabase. */
export function createServiceClient(): DbClient {
  return createClient({ rls: false, userId: null });
}

/**
 * Tunduk RLS sebagai pengguna tertentu.
 *
 * userId null diperbolehkan dan artinya pengunjung anonim — bukan error, dan
 * BUKAN akses service. RLS tetap menyala; query hanya melihat baris yang
 * policy-nya mengizinkan publik (katalog, pengaturan toko, pengumuman).
 */
export function createUserClient(userId: string | null): DbClient {
  // String kosong akan lolos sebagai "ada nilai" lalu gagal saat dicasting ke
  // uuid; dinormalkan ke null supaya jelas jadi anonim.
  const normalized = userId && userId.trim() !== "" ? userId : null;
  return createClient({ rls: true, userId: normalized });
}
