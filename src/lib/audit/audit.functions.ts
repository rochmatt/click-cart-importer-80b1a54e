import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware.server";
import { assertAdmin } from "@/lib/admin-access.server";
import { susunFilterAudit, susunFilterEmail } from "./filter";

// Pembacaan audit log dan log email untuk panel admin.
//
// Penyaringan dan pemotongan halaman dikerjakan DI DATABASE, bukan di browser.
// Tabel ini tumbuh terus selama situs dipakai; mengirim seluruh isinya ke
// browser lalu menyaringnya di sana akan bekerja dengan baik selama beberapa
// bulan pertama lalu perlahan membuat halaman ini tidak bisa dibuka.

const PER_HALAMAN = 25;

const filterSchema = z.object({
  cari: z.string().trim().max(200).default(""),
  entity: z.string().trim().max(40).default("semua"),
  action: z.string().trim().max(40).default("semua"),
  tanggal: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD")
    .or(z.literal(""))
    .default(""),
  halaman: z.number().int().min(1).max(10_000).default(1),
});

export type FilterAudit = z.infer<typeof filterSchema>;

/**
 * meta harus bertipe JSON eksplisit, bukan unknown: TanStack Start memeriksa
 * apakah nilai kembalian server function bisa diserialisasi, dan unknown gagal
 * pemeriksaan itu. Kolomnya memang jsonb, jadi tipe ini juga yang benar.
 */
export type NilaiJson = string | number | boolean | null | NilaiJson[] | { [k: string]: NilaiJson };

export interface BarisAudit {
  id: string;
  created_at: string;
  actor_email: string;
  entity: string;
  entity_id: string | null;
  entity_label: string;
  action: string;
  detail: string;
  meta: NilaiJson;
}

export interface HasilAudit {
  baris: BarisAudit[];
  total: number;
  halaman: number;
  perHalaman: number;
}

export const adminListAudit = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<HasilAudit> => {
    await assertAdmin(context.db, context.userId);
    const { run } = await import("@/lib/db/pool.server");
    const { where, params } = susunFilterAudit(data);

    const hitung = await run<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.audit_logs ${where}`,
      params,
      { rls: false },
    );
    const total = hitung[0]?.n ?? 0;

    const offset = (data.halaman - 1) * PER_HALAMAN;
    const hasil = await run<BarisAudit>(
      `SELECT id, created_at, actor_email, entity, entity_id, entity_label, action, detail, meta
         FROM public.audit_logs ${where}
        ORDER BY created_at DESC
        LIMIT ${PER_HALAMAN} OFFSET ${offset}`,
      params,
      { rls: false },
    );

    return {
      baris: hasil,
      total,
      halaman: data.halaman,
      perHalaman: PER_HALAMAN,
    };
  });

/**
 * Mengambil seluruh baris yang cocok filter untuk diekspor ke CSV.
 *
 * Dibatasi 5000 baris. Batas ini disebutkan ke pengguna di UI, bukan dipotong
 * diam-diam — file CSV yang kehilangan separuh isinya tanpa pemberitahuan lebih
 * berbahaya daripada ekspor yang menolak berjalan.
 */
export const MAKS_EKSPOR = 5000;

export const adminExportAudit = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ baris: BarisAudit[]; terpotong: boolean }> => {
    await assertAdmin(context.db, context.userId);
    const { run } = await import("@/lib/db/pool.server");
    const { where, params } = susunFilterAudit(data);

    const hasil = await run<BarisAudit>(
      `SELECT id, created_at, actor_email, entity, entity_id, entity_label, action, detail, meta
         FROM public.audit_logs ${where}
        ORDER BY created_at DESC
        LIMIT ${MAKS_EKSPOR + 1}`,
      params,
      { rls: false },
    );

    const baris = hasil;
    return { baris: baris.slice(0, MAKS_EKSPOR), terpotong: baris.length > MAKS_EKSPOR };
  });

// ---------------------------------------------------------------- log email

const filterEmailSchema = z.object({
  cari: z.string().trim().max(200).default(""),
  status: z.enum(["semua", "terkirim", "gagal"]).default("semua"),
  halaman: z.number().int().min(1).max(10_000).default(1),
});

export type FilterEmail = z.infer<typeof filterEmailSchema>;

export interface BarisEmail {
  id: string;
  created_at: string;
  recipient: string;
  subject: string;
  kind: string;
  order_number: string | null;
  status: string;
  provider_id: string | null;
  error_message: string | null;
}

export interface HasilEmail {
  baris: BarisEmail[];
  total: number;
  halaman: number;
  perHalaman: number;
}

// ------------------------------------------- percobaan kirim ulang email

const filterPercobaanSchema = z.object({
  cari: z.string().trim().max(200).default(""),
  hasil: z
    .enum(["semua", "diizinkan", "ditolak_cooldown", "ditolak_kuota", "ditolak_ip"])
    .default("semua"),
  jenis: z.enum(["semua", "verifikasi", "reset"]).default("semua"),
  halaman: z.number().int().min(1).max(10_000).default(1),
});

export interface BarisPercobaan {
  id: string;
  created_at: string;
  kind: string;
  email: string;
  outcome: string;
  email_dikirim: boolean;
  sisa_detik: number;
  terpakai: number;
  ip: string | null;
}

export interface HasilPercobaan {
  baris: BarisPercobaan[];
  total: number;
  halaman: number;
  perHalaman: number;
  /** Ringkasan pada rentang yang tersaring, untuk kepala halaman. */
  ringkasan: { diizinkan: number; ditolak: number; terkirim: number };
}

export const adminListResendAttempts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => filterPercobaanSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<HasilPercobaan> => {
    await assertAdmin(context.db, context.userId);
    const { run } = await import("@/lib/db/pool.server");

    const syarat: string[] = [];
    const params: unknown[] = [];
    if (data.cari) {
      params.push(`%${data.cari}%`);
      const i = params.length;
      syarat.push(`(email ILIKE $${i} OR ip ILIKE $${i})`);
    }
    if (data.hasil !== "semua") {
      params.push(data.hasil);
      syarat.push(`outcome = $${params.length}`);
    }
    if (data.jenis !== "semua") {
      params.push(data.jenis);
      syarat.push(`kind = $${params.length}`);
    }
    const where = syarat.length ? `WHERE ${syarat.join(" AND ")}` : "";

    // Hitungan dan ringkasan diambil sekali jalan: halaman menampilkan keduanya
    // bersamaan, dan dua perjalanan terpisah untuk angka yang berasal dari
    // baris yang sama hanya menambah peluang keduanya tidak cocok.
    const ringkas = await run<{
      total: number;
      diizinkan: number;
      ditolak: number;
      terkirim: number;
    }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE outcome = 'diizinkan')::int AS diizinkan,
              count(*) FILTER (WHERE outcome <> 'diizinkan')::int AS ditolak,
              count(*) FILTER (WHERE email_dikirim)::int AS terkirim
         FROM public.resend_attempts ${where}`,
      params,
      { rls: false },
    );
    const r = ringkas[0] ?? { total: 0, diizinkan: 0, ditolak: 0, terkirim: 0 };

    const offset = (data.halaman - 1) * PER_HALAMAN;
    const baris = await run<BarisPercobaan>(
      `SELECT id, created_at, kind, email, outcome, email_dikirim, sisa_detik, terpakai, ip
         FROM public.resend_attempts ${where}
        ORDER BY created_at DESC
        LIMIT ${PER_HALAMAN} OFFSET ${offset}`,
      params,
      { rls: false },
    );

    return {
      baris,
      total: r.total,
      halaman: data.halaman,
      perHalaman: PER_HALAMAN,
      ringkasan: { diizinkan: r.diizinkan, ditolak: r.ditolak, terkirim: r.terkirim },
    };
  });

export const adminListEmailLogs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => filterEmailSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<HasilEmail> => {
    await assertAdmin(context.db, context.userId);
    const { run } = await import("@/lib/db/pool.server");

    const { where, params } = susunFilterEmail(data);

    const hitung = await run<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.email_logs ${where}`,
      params,
      { rls: false },
    );
    const total = hitung[0]?.n ?? 0;

    const offset = (data.halaman - 1) * PER_HALAMAN;
    const hasil = await run<BarisEmail>(
      `SELECT id, created_at, recipient, subject, kind, order_number, status, provider_id, error_message
         FROM public.email_logs ${where}
        ORDER BY created_at DESC
        LIMIT ${PER_HALAMAN} OFFSET ${offset}`,
      params,
      { rls: false },
    );

    return {
      baris: hasil,
      total,
      halaman: data.halaman,
      perHalaman: PER_HALAMAN,
    };
  });
