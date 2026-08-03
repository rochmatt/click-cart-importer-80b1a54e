// @vitest-environment node
//
// Menguji alur akun terhadap PostgreSQL sungguhan. Modul sesi di-mock pada
// bagian yang menyentuh cookie; yang diuji di sini keputusan akunnya.

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sesiDicabut: string[] = [];
vi.mock("./session.server", () => ({
  destroyAllSessions: async (userId: string) => {
    sesiDicabut.push(userId);
  },
}));

const { daftar, masuk, resetPassword, siapkanReset, tokenVerifikasiUlang, verifikasiEmail } =
  await import("./accounts.server");
const { consumeToken, createToken } = await import("./tokens.server");
const { run, closePools } = await import("@/lib/db/pool.server");

const CONFIGURED = Boolean(process.env.DATABASE_URL);
const OWNER = { rls: false } as const;
const EMAIL = "uji.akun@contoh.id";
const PW = "password-uji-yang-cukup-panjang";

async function bersihkan() {
  await run("DELETE FROM auth.users WHERE lower(email) LIKE 'uji.akun%'", [], OWNER);
}

describe.skipIf(!CONFIGURED)("alur akun", () => {
  beforeEach(async () => {
    await bersihkan();
    sesiDicabut.length = 0;
  });

  afterAll(async () => {
    await bersihkan();
    await closePools();
  });

  describe("pendaftaran", () => {
    it("membuat pengguna, profil, dan token verifikasi", async () => {
      const hasil = await daftar(EMAIL, PW);
      expect(hasil.ok).toBe(true);
      if (!hasil.ok) return;

      const profil = await run<{ n: string }>(
        "SELECT count(*) AS n FROM public.profiles WHERE id = $1",
        [hasil.userId],
        OWNER,
      );
      expect(Number(profil[0].n)).toBe(1);
      expect(hasil.tokenVerifikasi).toBeTruthy();
    });

    it("password disimpan sebagai hash, bukan teks polos", async () => {
      const hasil = await daftar(EMAIL, PW);
      if (!hasil.ok) throw new Error("gagal daftar");
      const rows = await run<{ encrypted_password: string }>(
        "SELECT encrypted_password FROM auth.users WHERE id = $1",
        [hasil.userId],
        OWNER,
      );
      expect(rows[0].encrypted_password).not.toContain(PW);
      expect(rows[0].encrypted_password.startsWith("scrypt$")).toBe(true);
    });

    it("email ganda ditolak, termasuk beda kapitalisasi", async () => {
      expect((await daftar(EMAIL, PW)).ok).toBe(true);
      expect(await daftar(EMAIL, PW)).toEqual({ ok: false, alasan: "email_terpakai" });
      expect(await daftar(EMAIL.toUpperCase(), PW)).toEqual({
        ok: false,
        alasan: "email_terpakai",
      });
    });
  });

  describe("masuk", () => {
    it("ditolak sebelum email diverifikasi", async () => {
      await daftar(EMAIL, PW);
      expect(await masuk(EMAIL, PW)).toEqual({ ok: false, alasan: "belum_verifikasi" });
    });

    it("berhasil setelah verifikasi", async () => {
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      expect(await verifikasiEmail(d.tokenVerifikasi)).toBe(true);

      const hasil = await masuk(EMAIL, PW);
      expect(hasil.ok).toBe(true);
      if (hasil.ok) expect(hasil.user.email).toBe(EMAIL);
    });

    it("email tak dikenal dan password salah memberi alasan yang SAMA", async () => {
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      await verifikasiEmail(d.tokenVerifikasi);

      const salah = await masuk(EMAIL, "password-yang-salah");
      const asing = await masuk("tidak.ada@contoh.id", PW);
      expect(salah).toEqual({ ok: false, alasan: "kredensial_salah" });
      expect(asing).toEqual({ ok: false, alasan: "kredensial_salah" });
    });

    it("waktu tanggap email tak dikenal setara dengan password salah", async () => {
      // Tanpa hash umpan, email tak dikenal kembali seketika sementara email
      // terdaftar menunggu scrypt — selisihnya memetakan siapa punya akun.
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      await verifikasiEmail(d.tokenVerifikasi);

      const t1 = Date.now();
      await masuk(EMAIL, "password-yang-salah");
      const adaAkun = Date.now() - t1;

      const t2 = Date.now();
      await masuk("tidak.ada@contoh.id", PW);
      const tanpaAkun = Date.now() - t2;

      // Longgar: yang penting bukan mendekati nol saat akun tidak ada.
      expect(tanpaAkun).toBeGreaterThan(adaAkun * 0.3);
    });

    it("last_sign_in_at diperbarui", async () => {
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      await verifikasiEmail(d.tokenVerifikasi);
      await masuk(EMAIL, PW);

      const rows = await run<{ last_sign_in_at: string | null }>(
        "SELECT last_sign_in_at FROM auth.users WHERE id = $1",
        [d.userId],
        OWNER,
      );
      expect(rows[0].last_sign_in_at).not.toBeNull();
    });
  });

  describe("token", () => {
    it("token sekali-pakai: pemakaian kedua gagal", async () => {
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      expect(await verifikasiEmail(d.tokenVerifikasi)).toBe(true);
      expect(await verifikasiEmail(d.tokenVerifikasi)).toBe(false);
    });

    it("token verifikasi tidak bisa dipakai sebagai token reset", async () => {
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      const hasil = await resetPassword(d.tokenVerifikasi, "password-baru-panjang");
      expect(hasil).toEqual({ ok: false, alasan: "token_tidak_sah" });
    });

    it("token kedaluwarsa ditolak", async () => {
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      await run(
        "UPDATE auth.tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1",
        [d.userId],
        OWNER,
      );
      expect(await verifikasiEmail(d.tokenVerifikasi)).toBe(false);
    });

    it("meminta token baru membatalkan yang lama", async () => {
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      const lama = d.tokenVerifikasi;
      const baru = await createToken(d.userId, "signup");

      expect(await consumeToken(lama, "signup")).toBeNull();
      expect(await consumeToken(baru, "signup")).not.toBeNull();
    });
  });

  describe("reset password", () => {
    it("email tak dikenal mengembalikan null, tanpa membocorkan apa pun", async () => {
      expect(await siapkanReset("tidak.ada@contoh.id")).toBeNull();
    });

    it("password berganti dan seluruh sesi dicabut", async () => {
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      await verifikasiEmail(d.tokenVerifikasi);

      const siap = await siapkanReset(EMAIL);
      expect(siap).not.toBeNull();

      const hasil = await resetPassword(siap!.token, "password-baru-yang-panjang");
      expect(hasil).toEqual({ ok: true });

      expect(await masuk(EMAIL, PW)).toEqual({ ok: false, alasan: "kredensial_salah" });
      expect((await masuk(EMAIL, "password-baru-yang-panjang")).ok).toBe(true);
      expect(sesiDicabut).toContain(d.userId);
    });

    it("reset ikut memverifikasi email yang belum terverifikasi", async () => {
      // Pemiliknya terbukti menguasai kotak masuk, jadi menahan akses setelah
      // itu hanya menyulitkan tanpa menambah keamanan.
      const d = await daftar(EMAIL, PW);
      if (!d.ok) throw new Error("gagal daftar");
      const siap = await siapkanReset(EMAIL);
      await resetPassword(siap!.token, "password-baru-yang-panjang");
      expect((await masuk(EMAIL, "password-baru-yang-panjang")).ok).toBe(true);
    });
  });

  it("kirim ulang verifikasi hanya untuk akun yang belum terverifikasi", async () => {
    const d = await daftar(EMAIL, PW);
    if (!d.ok) throw new Error("gagal daftar");

    // Token kiriman ulang membatalkan token pendaftaran, jadi verifikasi harus
    // memakai yang TERBARU. Urutan ini sengaja mengikuti perilaku sebenarnya.
    const ulang = await tokenVerifikasiUlang(EMAIL);
    expect(ulang).toBeTruthy();
    expect(await verifikasiEmail(d.tokenVerifikasi)).toBe(false);
    expect(await verifikasiEmail(ulang!)).toBe(true);

    expect(await tokenVerifikasiUlang(EMAIL)).toBeNull();
    expect(await tokenVerifikasiUlang("tidak.ada@contoh.id")).toBeNull();
  });
});
