// @vitest-environment node
//
// Menguji audit log terhadap PostgreSQL sungguhan.
//
// Mengikuti penjagaan yang sama seperti admin-products.test.ts: setiap baris uji
// diberi penanda unik, dan tes membuktikan tidak ada baris di luar penandanya
// yang tersentuh — bukan dengan menghitung jumlah, melainkan membandingkan isi.
// Versi awal tes lain di repo ini pernah merusak data nyata justru karena hanya
// memeriksa jumlah baris.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { catatAudit, catatAuditBanyak, kolomBerubah } from "./log.server";
import { susunFilterAudit, susunFilterEmail } from "./filter";
import { closePools, run } from "../db/pool.server";

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const P = "zzuji-audit-";

async function bersihkan() {
  await run("DELETE FROM audit_logs WHERE actor_email LIKE $1", [`${P}%`], OWNER);
}

/** Sidik jari seluruh baris audit di luar milik tes ini. */
async function sidikJariAsli(): Promise<string> {
  const rows = await run<{ sidik: string }>(
    `SELECT coalesce(string_agg(id::text, ',' ORDER BY id), '') AS sidik
       FROM audit_logs WHERE actor_email NOT LIKE $1`,
    [`${P}%`],
    OWNER,
  );
  return rows[0].sidik;
}

const dasar = {
  actorId: null as unknown as string,
  actorEmail: `${P}admin@contoh.test`,
  entity: "produk" as const,
  action: "ubah" as const,
};

describe.skipIf(!CONFIGURED)("audit log", () => {
  let sidikAwal = "";

  beforeEach(async () => {
    if (!sidikAwal) sidikAwal = await sidikJariAsli();
    await bersihkan();
  });

  afterAll(async () => {
    await bersihkan();
    // Membuktikan tes ini tidak menyentuh catatan audit sungguhan.
    expect(await sidikJariAsli()).toBe(sidikAwal);
    await closePools();
  });

  it("menulis satu baris dengan kolom yang benar", async () => {
    await catatAudit({
      ...dasar,
      entityId: "abc-123",
      entityLabel: "Kursi Kayu",
      detail: "Mengubah: price",
      meta: { price: { dari: 100, ke: 200 } },
    });

    const rows = await run<{
      actor_email: string;
      entity: string;
      entity_id: string;
      entity_label: string;
      action: string;
      detail: string;
      meta: { price: { dari: number; ke: number } };
    }>("SELECT * FROM audit_logs WHERE actor_email = $1", [dasar.actorEmail], OWNER);

    expect(rows).toHaveLength(1);
    expect(rows[0].entity_label).toBe("Kursi Kayu");
    expect(rows[0].detail).toBe("Mengubah: price");
    // meta harus kembali sebagai objek, bukan string — kolomnya jsonb.
    expect(rows[0].meta.price.ke).toBe(200);
  });

  it("menulis banyak baris sekaligus, satu per entitas", async () => {
    await catatAuditBanyak([
      { ...dasar, action: "hapus", entityId: "a", entityLabel: "Produk A" },
      { ...dasar, action: "hapus", entityId: "b", entityLabel: "Produk B" },
    ]);

    const rows = await run<{ entity_label: string }>(
      "SELECT entity_label FROM audit_logs WHERE actor_email = $1 ORDER BY entity_label",
      [dasar.actorEmail],
      OWNER,
    );
    expect(rows.map((r) => r.entity_label)).toEqual(["Produk A", "Produk B"]);
  });

  it("tidak melempar walau catatannya tidak valid", async () => {
    // entity di luar daftar CHECK. Penulisan pasti ditolak database; yang diuji
    // adalah bahwa penolakan itu TIDAK merambat ke pemanggil, karena pemanggil
    // adalah aksi admin yang sudah berhasil dan tidak boleh ikut gagal.
    await expect(
      catatAudit({ ...dasar, entity: "entitas-palsu" as never, entityLabel: "x" }),
    ).resolves.toBeUndefined();

    const rows = await run(
      "SELECT id FROM audit_logs WHERE actor_email = $1",
      [dasar.actorEmail],
      OWNER,
    );
    expect(rows).toHaveLength(0);
  });

  it("menolak UPDATE dan DELETE lewat jalur RLS", async () => {
    await catatAudit({ ...dasar, entityLabel: "Tak Boleh Diubah" });

    // Pool RLS adalah jalur yang dipakai kode aplikasi untuk permintaan
    // pengguna. Dua lapis menghalangi di sini: peran itu hanya diberi SELECT,
    // dan tabelnya tidak punya policy UPDATE/DELETE. Yang diuji adalah HASIL —
    // baris tetap utuh — bukan lapisan mana yang menolak, supaya tes tetap
    // berlaku kalau salah satu lapisan berubah.
    const coba = async (sql: string) => {
      try {
        await run(sql, [dasar.actorEmail], { rls: true, userId: null });
      } catch {
        /* ditolak di lapisan hak akses; itu salah satu hasil yang benar */
      }
    };
    await coba("UPDATE audit_logs SET detail = 'diretas' WHERE actor_email = $1");
    await coba("DELETE FROM audit_logs WHERE actor_email = $1");

    const rows = await run<{ detail: string }>(
      "SELECT detail FROM audit_logs WHERE actor_email = $1",
      [dasar.actorEmail],
      OWNER,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).not.toBe("diretas");
  });
});

describe.skipIf(!CONFIGURED)("query halaman audit", () => {
  beforeEach(bersihkan);

  afterAll(async () => {
    await bersihkan();
    await closePools();
  });

  /** Menjalankan query yang PERSIS dipakai halaman /admin/audit. */
  async function jalankan(filter: Parameters<typeof susunFilterAudit>[0]) {
    const { where, params } = susunFilterAudit(filter);
    return run<{ entity_label: string; meta: unknown }>(
      `SELECT id, created_at, actor_email, entity, entity_id, entity_label, action, detail, meta
         FROM public.audit_logs ${where}
        ORDER BY created_at DESC LIMIT 25 OFFSET 0`,
      params,
      OWNER,
    );
  }

  it("menyaring gabungan cari + entitas + aksi, dan meta kembali sebagai objek", async () => {
    await catatAudit({
      ...dasar,
      action: "ubah_status",
      entityLabel: "Kursi Rotan Uji",
      detail: "Status draft → active",
      meta: { dari: "draft", ke: "active" },
    });
    await catatAudit({ ...dasar, action: "hapus", entityLabel: "Meja Lain" });

    const cocok = await jalankan({
      cari: "rotan",
      entity: "produk",
      action: "ubah_status",
      tanggal: "",
    });
    expect(cocok).toHaveLength(1);
    expect(cocok[0].entity_label).toBe("Kursi Rotan Uji");
    // jsonb harus kembali sebagai objek; kalau string, UI akan menampilkan JSON mentah.
    expect(typeof cocok[0].meta).toBe("object");

    // Aksi yang tidak diminta tidak boleh ikut terbawa.
    const salahAksi = await jalankan({
      cari: "rotan",
      entity: "produk",
      action: "hapus",
      tanggal: "",
    });
    expect(salahAksi).toHaveLength(0);
  });

  it("filter tanggal hari ini menemukan baris yang baru ditulis", async () => {
    await catatAudit({ ...dasar, entityLabel: "Baru Saja" });
    const hariIni = await run<{ d: string }>(
      "SELECT to_char((now() AT TIME ZONE current_setting('TimeZone'))::date, 'YYYY-MM-DD') AS d",
      [],
      OWNER,
    );
    const hasil = await jalankan({
      cari: "",
      entity: "semua",
      action: "semua",
      tanggal: hariIni[0].d,
    });
    expect(hasil.length).toBeGreaterThan(0);
  });

  it("kutip tunggal di pencarian tidak menjatuhkan query", async () => {
    // Bukti bahwa nilai lewat parameter terikat, bukan dirangkai ke SQL.
    await catatAudit({ ...dasar, entityLabel: "Kursi O'Brien" });
    const hasil = await jalankan({
      cari: "O'Brien",
      entity: "semua",
      action: "semua",
      tanggal: "",
    });
    expect(hasil).toHaveLength(1);
  });
});

describe("susunFilterEmail", () => {
  it("menomori parameter berurutan saat dua filter dipakai bersamaan", () => {
    const { where, params } = susunFilterEmail({ cari: "budi", status: "gagal" });
    expect(params).toEqual(["%budi%", "gagal"]);
    expect(where).toContain("$1");
    expect(where).toContain("status = $2");
  });

  it("tanpa filter menghasilkan WHERE kosong, bukan 'WHERE'", () => {
    expect(susunFilterEmail({ cari: "", status: "semua" }).where).toBe("");
  });
});

describe("kolomBerubah", () => {
  it("mengabaikan nilai yang sama walau objeknya berbeda", () => {
    expect(kolomBerubah({ images: ["a", "b"] }, { images: ["a", "b"] })).toEqual([]);
  });

  it("menemukan kolom yang benar-benar berubah", () => {
    expect(kolomBerubah({ price: 100, title: "x" }, { price: 200, title: "x" })).toEqual(["price"]);
  });

  it("mengembalikan kosong saat tidak ada baris sebelumnya", () => {
    expect(kolomBerubah(null, { price: 200 })).toEqual([]);
  });
});
