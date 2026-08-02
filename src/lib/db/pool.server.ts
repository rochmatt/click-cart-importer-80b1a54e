// Koneksi ke PostgreSQL lokal. Server-only — jangan di-import dari komponen client.
//
// Dua pool, meniru pemisahan hak akses Supabase (lihat db/schema.sql):
//
//   service -> role `inipilihanku`, pemilik tabel, MELEWATI RLS.
//              Untuk operasi admin/sistem yang memang perlu lintas pengguna.
//   app     -> role `inipilihanku_app`, TUNDUK RLS.
//              Untuk query atas nama pengguna.

import { Pool, type PoolClient } from "pg";

let servicePool: Pool | undefined;
let appPool: Pool | undefined;

function createPool(url: string | undefined, name: string): Pool {
  if (!url) {
    throw new Error(`${name} is not configured`);
  }
  return new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function getServicePool(): Pool {
  if (!servicePool) servicePool = createPool(process.env.DATABASE_URL, "DATABASE_URL");
  return servicePool;
}

export function getAppPool(): Pool {
  if (!appPool) appPool = createPool(process.env.DATABASE_URL_APP, "DATABASE_URL_APP");
  return appPool;
}

export interface RunOptions {
  /**
   * Wajib. Menentukan pool mana yang dipakai, TERPISAH dari userId.
   *
   * Jangan pernah menyimpulkan ini dari ada/tidaknya userId. Pengunjung anonim
   * punya userId null tapi tetap harus tunduk RLS; kalau disimpulkan dari
   * userId, permintaan anonim justru mendarat di pool service yang melewati
   * RLS — persis kebalikan dari yang diinginkan.
   */
  rls: boolean;
  /** Identitas untuk auth.uid(). null berarti anonim: hanya policy publik yang lolos. */
  userId?: string | null;
}

/**
 * Menjalankan satu query.
 *
 * Saat rls aktif, query WAJIB berjalan di dalam transaksi: set_config dengan
 * is_local=true hanya berlaku sampai akhir transaksi. Tanpa transaksi, nilainya
 * menempel di koneksi dan — karena koneksi dipakai bergantian dari pool —
 * permintaan pengguna BERIKUTNYA bisa mewarisi identitas pengguna sebelumnya.
 * Itu kebocoran data lintas pengguna, jadi jangan dijadikan set_config biasa.
 */
export async function run<T = any>(
  text: string,
  values: unknown[],
  options: RunOptions,
): Promise<T[]> {
  const useRls = options.rls;
  const pool = useRls ? getAppPool() : getServicePool();
  const client: PoolClient = await pool.connect();

  try {
    if (!useRls) {
      const result = await client.query(text, values);
      return result.rows as T[];
    }

    await client.query("BEGIN");
    try {
      // set_config dengan parameter, bukan interpolasi string — SET LOCAL tidak
      // menerima placeholder, dan menyambung uuid langsung ke SQL itu jalur
      // injeksi meski nilainya berasal dari sesi.
      //
      // String kosong untuk anonim: auth.uid() memakai NULLIF(...,'')::uuid,
      // jadi nilainya jadi NULL dan hanya policy publik yang lolos.
      await client.query("SELECT set_config('app.user_id', $1, true)", [options.userId ?? ""]);
      const result = await client.query(text, values);
      await client.query("COMMIT");
      return result.rows as T[];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

/** Ditutup saat proses berhenti supaya pm2 restart tidak meninggalkan koneksi menggantung. */
export async function closePools(): Promise<void> {
  await Promise.all([servicePool?.end(), appPool?.end()]);
  servicePool = undefined;
  appPool = undefined;
}
