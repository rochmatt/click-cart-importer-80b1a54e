// @vitest-environment node
//
// Audience targeting pengumuman terhadap PostgreSQL sungguhan.
//
// announcement-window.test.ts menguji LOGIKA pemilihan penonton dengan angka.
// Berkas ini menutup yang tidak bisa diuji dengan angka: bahwa kolom `audience`
// benar-benar ada, ber-DEFAULT 'all', menolak nilai di luar daftar (CHECK), dan
// kembali sebagai string yang pengumumanUntukPenonton bisa nilai. Kalau migrasi
// db/009 tidak diterapkan atau constraint-nya melenceng, di sinilah ketahuan —
// unit test angka tetap lulus, produksi yang rusak.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pengumumanUntukPenonton } from "./announcement-window";
import { closePools, run } from "./db/pool.server";

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const P = "zzuji-audiens-";

const TAMU = { loggedIn: false, roles: [] as string[] };
const MEMBER = { loggedIn: true, roles: [] as string[] };
const ADMIN = { loggedIn: true, roles: ["admin"] };

async function bersihkan() {
  await run("DELETE FROM public.announcements WHERE title LIKE $1", [`${P}%`], OWNER);
}

async function buat(title: string, audience?: string) {
  if (audience === undefined) {
    await run(
      `INSERT INTO public.announcements (title, message, kind, is_active)
       VALUES ($1, 'uji', 'info', true)`,
      [title],
      OWNER,
    );
  } else {
    await run(
      `INSERT INTO public.announcements (title, message, kind, is_active, audience)
       VALUES ($1, 'uji', 'info', true, $2)`,
      [title, audience],
      OWNER,
    );
  }
}

async function baca(title: string) {
  const rows = await run<{ audience: string }>(
    "SELECT audience FROM public.announcements WHERE title = $1",
    [title],
    OWNER,
  );
  return rows[0];
}

describe.skipIf(!CONFIGURED)("audience targeting pengumuman (round-trip DB)", () => {
  beforeEach(bersihkan);

  afterAll(async () => {
    await bersihkan();
    await closePools();
  });

  it("kolom audience ber-DEFAULT 'all' saat tidak disetel", async () => {
    // Jalur lama (dan baris sebelum migrasi) tidak menyebut audience sama sekali;
    // harus jatuh ke 'all' supaya tetap tampil ke semua, bukan NULL/hilang.
    await buat(`${P}default`);
    expect((await baca(`${P}default`)).audience).toBe("all");
  });

  it("nilai audience yang valid kembali apa adanya", async () => {
    for (const a of ["all", "guest", "member", "admin", "moderator"]) {
      await buat(`${P}${a}`, a);
      expect((await baca(`${P}${a}`)).audience).toBe(a);
    }
  });

  it("CHECK menolak audience di luar daftar", async () => {
    await expect(buat(`${P}invalid`, "segmen-ngawur")).rejects.toThrow();
  });

  it("baris tersimpan menyaring penonton sesuai sasaran", async () => {
    // Membuktikan seluruh jalur: nilai yang ditulis DB, dibaca balik, lalu
    // dinilai predikat aplikasi — persis seperti fetchAnnouncements.
    await buat(`${P}guest`, "guest");
    await buat(`${P}member`, "member");
    await buat(`${P}admin`, "admin");

    const g = (await baca(`${P}guest`)).audience;
    const m = (await baca(`${P}member`)).audience;
    const ad = (await baca(`${P}admin`)).audience;

    expect(pengumumanUntukPenonton(g, TAMU)).toBe(true);
    expect(pengumumanUntukPenonton(g, MEMBER)).toBe(false);
    expect(pengumumanUntukPenonton(m, TAMU)).toBe(false);
    expect(pengumumanUntukPenonton(m, MEMBER)).toBe(true);
    expect(pengumumanUntukPenonton(ad, MEMBER)).toBe(false);
    expect(pengumumanUntukPenonton(ad, ADMIN)).toBe(true);
  });
});
