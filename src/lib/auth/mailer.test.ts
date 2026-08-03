// @vitest-environment node
//
// Uji ujung-ke-ujung alur email autentikasi: mendaftar, merender template
// React Email, mengirimnya ke server Resend tiruan yang berjalan di dalam tes
// ini, mengambil token dari tautan di dalam email, lalu memakainya untuk
// verifikasi dan reset.
//
// Yang dibuktikan di sini adalah RANTAINYA. Tes modul lain sudah membuktikan
// setiap bagian secara terpisah, tapi tautan yang salah bentuk atau token yang
// tidak selamat melewati perenderan HTML hanya terlihat pada uji seperti ini.

import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./session.server", () => ({ destroyAllSessions: async () => {} }));

const { daftar, masuk, resetPassword, siapkanReset, verifikasiEmail } =
  await import("./accounts.server");
const { kirimEmailReset, kirimEmailVerifikasi } = await import("./mailer.server");
const { run, closePools } = await import("@/lib/db/pool.server");

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const EMAIL = "uji.mailer@contoh.id";
const PW = "password-uji-yang-panjang";

interface Tertangkap {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

let server: Server;
let tertangkap: Tertangkap[] = [];
let envAsli: { endpoint?: string; key?: string; site?: string };

/** Mengambil token dari tautan pertama yang menunjuk path tertentu. */
function tokenDari(email: Tertangkap, path: string): string | null {
  // Entitas HTML di-decode: &amp; di dalam href akan merusak parsing query.
  const html = email.html.replace(/&amp;/g, "&");
  const cocok = html.match(new RegExp(`https?://[^"'\\s]*${path}\\?[^"'\\s]*`));
  if (!cocok) return null;
  return new URL(cocok[0]).searchParams.get("token");
}

describe.skipIf(!CONFIGURED)("email autentikasi ujung-ke-ujung", () => {
  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        tertangkap.push(JSON.parse(body));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "mock-id" }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;

    envAsli = {
      endpoint: process.env.RESEND_ENDPOINT,
      key: process.env.RESEND_API_KEY,
      site: process.env.SITE_URL,
    };
    process.env.RESEND_ENDPOINT = `http://127.0.0.1:${port}/emails`;
    process.env.RESEND_API_KEY = "re_uji";
    process.env.SITE_URL = "https://inipilihanku.com";
  });

  afterAll(async () => {
    process.env.RESEND_ENDPOINT = envAsli.endpoint ?? "";
    process.env.RESEND_API_KEY = envAsli.key ?? "";
    process.env.SITE_URL = envAsli.site ?? "";
    if (!envAsli.endpoint) delete process.env.RESEND_ENDPOINT;
    await new Promise<void>((r) => server.close(() => r()));
    await run("DELETE FROM auth.users WHERE lower(email) LIKE 'uji.mailer%'", [], OWNER);
    await closePools();
  });

  beforeEach(async () => {
    tertangkap = [];
    await run("DELETE FROM auth.users WHERE lower(email) LIKE 'uji.mailer%'", [], OWNER);
  });

  it("email verifikasi terkirim dengan tautan yang bisa dipakai", async () => {
    const d = await daftar(EMAIL, PW);
    if (!d.ok) throw new Error("gagal daftar");
    await kirimEmailVerifikasi(EMAIL, d.tokenVerifikasi);

    expect(tertangkap).toHaveLength(1);
    const email = tertangkap[0];
    expect(email.to).toEqual([EMAIL]);
    expect(email.subject).toBe("Confirm your email");
    expect(email.html.length).toBeGreaterThan(500);
    expect(email.text.length).toBeGreaterThan(20);

    const token = tokenDari(email, "/verify-email");
    expect(token).toBe(d.tokenVerifikasi);

    // Token yang selamat melewati perenderan HTML harus tetap berfungsi.
    expect(await verifikasiEmail(token!)).toBe(true);
    expect((await masuk(EMAIL, PW)).ok).toBe(true);
  });

  it("tautan verifikasi memakai https dan domain situs, bukan localhost", async () => {
    const d = await daftar(EMAIL, PW);
    if (!d.ok) throw new Error("gagal daftar");
    await kirimEmailVerifikasi(EMAIL, d.tokenVerifikasi);

    const html = tertangkap[0].html.replace(/&amp;/g, "&");
    const url = new URL(html.match(/https?:\/\/[^"'\s]*\/verify-email\?[^"'\s]*/)![0]);
    expect(url.protocol).toBe("https:");
    expect(url.host).toBe("inipilihanku.com");
    expect(url.pathname).toBe("/verify-email");
  });

  it("email reset terkirim dan tokennya bisa mengganti password", async () => {
    const d = await daftar(EMAIL, PW);
    if (!d.ok) throw new Error("gagal daftar");
    await verifikasiEmail(d.tokenVerifikasi);

    const siap = await siapkanReset(EMAIL);
    await kirimEmailReset(EMAIL, siap!.token);

    const email = tertangkap.at(-1)!;
    expect(email.subject).toBe("Reset your password");

    const token = tokenDari(email, "/reset-password");
    expect(token).toBe(siap!.token);

    expect(await resetPassword(token!, "password-baru-sekali")).toEqual({ ok: true });
    expect((await masuk(EMAIL, "password-baru-sekali")).ok).toBe(true);
    expect((await masuk(EMAIL, PW)).ok).toBe(false);
  });

  it("pengirim memakai EMAIL_FROM, bukan alamat yang dikarang", async () => {
    const d = await daftar(EMAIL, PW);
    if (!d.ok) throw new Error("gagal daftar");
    await kirimEmailVerifikasi(EMAIL, d.tokenVerifikasi);
    const from = (tertangkap[0] as unknown as { from: string }).from;
    expect(from).toContain("@");
    expect(from).not.toContain("undefined");
  });
});
