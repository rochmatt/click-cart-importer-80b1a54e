// Koneksi ke PostgreSQL lokal. Server-only — jangan di-import dari komponen client.
//
// Dua pool, meniru pemisahan hak akses Supabase (lihat db/schema.sql):
//
//   service -> role `inipilihanku`, pemilik tabel, MELEWATI RLS.
//              Untuk operasi admin/sistem yang memang perlu lintas pengguna.
//   app     -> role `inipilihanku_app`, TUNDUK RLS.
//              Untuk query atas nama pengguna.

import { Pool, types, type PoolClient } from "pg";

/**
 * Menyamakan tipe hasil query dengan yang dikirim PostgREST/Supabase.
 *
 * Ini BUKAN kosmetik. node-pg secara default mengembalikan bigint dan numeric
 * sebagai STRING (karena bigint bisa melampaui Number), serta date dan
 * timestamptz sebagai objek Date. PostgREST mengirim semuanya lewat JSON:
 * angka sebagai number, tanggal sebagai string.
 *
 * Tanpa penyamaan ini, kode pemanggil yang sudah ada rusak DIAM-DIAM:
 *
 *   0 + row.total   ->  "0150000"     bukan 150000
 *   a.total + b.total -> "150000200000"  bukan 350000
 *
 * Tidak ada error, tidak ada peringatan — hanya laporan penjualan dan lifetime
 * value pelanggan yang jadi sampah. Lihat admin.functions.ts dan
 * sales-analytics.ts yang menjumlahkan kolom-kolom ini.
 *
 * Dipasang di tingkat modul pg, jadi berlaku untuk kedua pool.
 */
function samakanTipeDenganPostgrest(): void {
  // bigint: dijadikan number seperti PostgREST, tapi kalau nilainya melampaui
  // rentang aman JavaScript, string dipertahankan — lebih baik pemanggil
  // melihat tipe tak terduga daripada angka yang diam-diam salah.
  types.setTypeParser(types.builtins.INT8, (v) => {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : v;
  });

  types.setTypeParser(types.builtins.NUMERIC, (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  });

  // date: PostgREST mengirim "2026-07-04". Objek Date akan bergeser satu hari
  // di zona waktu negatif, jadi teks aslinya dibiarkan apa adanya.
  types.setTypeParser(types.builtins.DATE, (v) => v);

  types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => new Date(v).toISOString());
  // timestamp tanpa zona disimpan PostgreSQL sebagai waktu polos; ditafsirkan
  // UTC agar konsisten dengan kolom timestamptz.
  types.setTypeParser(types.builtins.TIMESTAMP, (v) => new Date(`${v}Z`).toISOString());
}

samakanTipeDenganPostgrest();

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
