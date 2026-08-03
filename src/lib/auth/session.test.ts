// @vitest-environment node
//
// Menguji manajemen sesi terhadap PostgreSQL sungguhan. Lapisan cookie dan
// request TanStack di-mock karena tes ini berjalan di luar siklus permintaan
// HTTP; yang diuji adalah logika sesi dan SQL-nya, bukan framework-nya.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookies = new Map<string, string>();
let headers = new Headers();

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => cookies.get(name),
  setCookie: (name: string, value: string, options?: { maxAge?: number }) => {
    if (options?.maxAge === 0 || value === "") cookies.delete(name);
    else cookies.set(name, value);
  },
  getRequest: () => ({ headers }),
}));

const {
  SESSION_COOKIE,
  createSession,
  destroyAllSessions,
  destroySession,
  getSessionUser,
  pruneExpiredSessions,
} = await import("./session.server");
const { run, closePools } = await import("@/lib/db/pool.server");

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const BUDI = "bbbbbbbb-0000-4000-8000-000000000001";
const SITI = "bbbbbbbb-0000-4000-8000-000000000002";

async function bersihkan() {
  await run("DELETE FROM auth.users WHERE id = ANY($1)", [[BUDI, SITI]], OWNER);
}

describe.skipIf(!CONFIGURED)("sesi login", () => {
  beforeAll(async () => {
    await bersihkan();
    await run(
      `INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
         ($1,'budi.sesi@contoh.id', now()), ($2,'siti.sesi@contoh.id', NULL)`,
      [BUDI, SITI],
      OWNER,
    );
  });

  afterAll(async () => {
    await bersihkan();
    await closePools();
  });

  beforeEach(async () => {
    cookies.clear();
    headers = new Headers({ "user-agent": "uji/1.0", "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    // Sesi ikut dibersihkan, bukan hanya cookie: tanpa ini sesi dari tes
    // sebelumnya menumpuk dan assertion berbasis jumlah jadi tidak bermakna.
    await run("DELETE FROM auth.sessions WHERE user_id = ANY($1)", [[BUDI, SITI]], OWNER);
  });

  it("tanpa cookie tidak ada pengguna", async () => {
    expect(await getSessionUser()).toBeNull();
  });

  it("membuat sesi lalu mengenalinya kembali", async () => {
    await createSession(BUDI);
    const token = cookies.get(SESSION_COOKIE);
    expect(token).toBeTruthy();

    const user = await getSessionUser();
    expect(user?.id).toBe(BUDI);
    expect(user?.email).toBe("budi.sesi@contoh.id");
    expect(user?.emailConfirmed).toBe(true);
  });

  it("emailConfirmed false untuk akun yang belum verifikasi", async () => {
    await createSession(SITI);
    expect((await getSessionUser())?.emailConfirmed).toBe(false);
  });

  it("token mentah TIDAK tersimpan di database, hanya hash-nya", async () => {
    await createSession(BUDI);
    const token = cookies.get(SESSION_COOKIE)!;
    const rows = await run<{ n: string }>(
      "SELECT count(*) AS n FROM auth.sessions WHERE token_hash = $1",
      [token],
      OWNER,
    );
    expect(Number(rows[0].n)).toBe(0);
  });

  it("token yang dikarang ditolak", async () => {
    await createSession(BUDI);
    cookies.set(SESSION_COOKIE, "token-palsu-yang-tidak-pernah-diterbitkan");
    expect(await getSessionUser()).toBeNull();
  });

  it("hanya IP pertama dari x-forwarded-for yang disimpan", async () => {
    await createSession(BUDI);
    const rows = await run<{ ip: string; user_agent: string }>(
      "SELECT ip, user_agent FROM auth.sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [BUDI],
      OWNER,
    );
    expect(rows[0].ip).toBe("203.0.113.9");
    expect(rows[0].user_agent).toBe("uji/1.0");
  });

  it("sesi kedaluwarsa ditolak DAN dihapus", async () => {
    await createSession(BUDI);
    await run(
      "UPDATE auth.sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1",
      [BUDI],
      OWNER,
    );
    expect(await getSessionUser()).toBeNull();

    const sisa = await run<{ n: string }>(
      "SELECT count(*) AS n FROM auth.sessions WHERE user_id = $1",
      [BUDI],
      OWNER,
    );
    expect(Number(sisa[0].n)).toBe(0);
  });

  it("logout menghapus sesi dan cookie", async () => {
    await createSession(BUDI);
    await destroySession();
    expect(cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(await getSessionUser()).toBeNull();
  });

  it("logout tanpa sesi aktif tidak melempar", async () => {
    await expect(destroySession()).resolves.not.toThrow();
  });

  it("destroyAllSessions mencabut perangkat lain", async () => {
    // Dua sesi terpisah untuk pengguna yang sama, meniru dua perangkat.
    await createSession(BUDI);
    const perangkatA = cookies.get(SESSION_COOKIE)!;
    cookies.clear();
    await createSession(BUDI);
    const perangkatB = cookies.get(SESSION_COOKIE)!;
    expect(perangkatA).not.toBe(perangkatB);

    await destroyAllSessions(BUDI);

    for (const t of [perangkatA, perangkatB]) {
      cookies.set(SESSION_COOKIE, t);
      expect(await getSessionUser()).toBeNull();
    }
  });

  it("sesi pengguna lain tidak ikut tercabut", async () => {
    await createSession(SITI);
    const siti = cookies.get(SESSION_COOKIE)!;
    cookies.clear();
    await createSession(BUDI);

    await destroyAllSessions(BUDI);

    cookies.set(SESSION_COOKIE, siti);
    expect((await getSessionUser())?.id).toBe(SITI);
  });

  it("menghapus pengguna ikut menghapus sesinya (cascade)", async () => {
    await createSession(SITI);
    const token = cookies.get(SESSION_COOKIE)!;
    await run("DELETE FROM auth.users WHERE id = $1", [SITI], OWNER);
    cookies.set(SESSION_COOKIE, token);
    expect(await getSessionUser()).toBeNull();

    // Dikembalikan untuk tes berikutnya.
    await run(
      "INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1,'siti.sesi@contoh.id', NULL)",
      [SITI],
      OWNER,
    );
  });

  it("pruneExpiredSessions membuang yang lewat waktu saja", async () => {
    await createSession(BUDI);
    await run(
      "UPDATE auth.sessions SET expires_at = now() - interval '1 day' WHERE user_id = $1",
      [BUDI],
      OWNER,
    );
    cookies.clear();
    await createSession(SITI);

    const dibuang = await pruneExpiredSessions();
    expect(dibuang).toBeGreaterThanOrEqual(1);

    const sisa = await run<{ user_id: string }>(
      "SELECT user_id FROM auth.sessions WHERE user_id = ANY($1)",
      [[BUDI, SITI]],
      OWNER,
    );
    expect(sisa.map((r) => r.user_id)).toEqual([SITI]);
  });
});
