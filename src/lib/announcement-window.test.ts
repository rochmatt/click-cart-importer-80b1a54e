import { describe, expect, it } from "vitest";
import { pengumumanTampil } from "./announcement-window";

// Jendela penjadwalan pengumuman: kapan banner muncul dan hilang.
//
// Dua hal yang diuji: batas waktu (tidak tampil sebelum mulai, tidak tampil
// setelah berakhir, inklusif tepat di ujung) dan konsistensi timezone — bahwa
// perbandingannya membandingkan INSTAN, bukan jam dinding, sehingga starts_at
// yang ditulis dengan offset berapa pun dinilai pada titik waktu yang sama.

/** Instan acuan: 2026-08-04 10:00:00 WIB = 03:00:00 UTC. */
const NOW = Date.parse("2026-08-04T03:00:00.000Z");

const aktif = (starts_at?: string | null, ends_at?: string | null) => ({
  is_active: true,
  starts_at,
  ends_at,
});

describe("pengumumanTampil — batas waktu", () => {
  it("tidak tampil sebelum waktu mulai", () => {
    // Mulai satu jam dari sekarang.
    expect(pengumumanTampil(aktif("2026-08-04T04:00:00.000Z"), NOW)).toBe(false);
  });

  it("tampil setelah waktu mulai lewat", () => {
    expect(pengumumanTampil(aktif("2026-08-04T02:00:00.000Z"), NOW)).toBe(true);
  });

  it("tidak tampil setelah waktu berakhir", () => {
    expect(
      pengumumanTampil(aktif("2026-08-04T01:00:00.000Z", "2026-08-04T02:00:00.000Z"), NOW),
    ).toBe(false);
  });

  it("tampil di dalam jendela mulai–berakhir", () => {
    expect(
      pengumumanTampil(aktif("2026-08-04T02:00:00.000Z", "2026-08-04T04:00:00.000Z"), NOW),
    ).toBe(true);
  });

  it("batas mulai INKLUSIF: tepat pada starts_at sudah tampil", () => {
    // Promo "mulai pukul 10:00" harus muncul pada 10:00:00.000, bukan semenit
    // kemudian. Off-by-satu di sini adalah bug yang paling sering dikeluhkan.
    expect(pengumumanTampil(aktif("2026-08-04T03:00:00.000Z"), NOW)).toBe(true);
  });

  it("batas berakhir INKLUSIF: tepat pada ends_at masih tampil", () => {
    expect(pengumumanTampil(aktif(null, "2026-08-04T03:00:00.000Z"), NOW)).toBe(true);
  });

  it("satu milidetik sesudah berakhir sudah hilang", () => {
    expect(pengumumanTampil(aktif(null, "2026-08-04T02:59:59.999Z"), NOW)).toBe(false);
  });

  it("satu milidetik sebelum mulai belum tampil", () => {
    expect(pengumumanTampil(aktif("2026-08-04T03:00:00.001Z"), NOW)).toBe(false);
  });
});

describe("pengumumanTampil — status & data kosong", () => {
  it("is_active=false tidak pernah tampil, walau di dalam jendela", () => {
    expect(
      pengumumanTampil(
        {
          is_active: false,
          starts_at: "2026-08-04T02:00:00.000Z",
          ends_at: "2026-08-04T04:00:00.000Z",
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("tanpa starts_at berarti sudah mulai", () => {
    expect(pengumumanTampil(aktif(null, "2026-08-04T04:00:00.000Z"), NOW)).toBe(true);
    expect(pengumumanTampil(aktif(undefined, null), NOW)).toBe(true);
  });

  it("ends_at null berarti tidak pernah berakhir", () => {
    expect(pengumumanTampil(aktif("2026-01-01T00:00:00.000Z", null), NOW)).toBe(true);
  });

  it("tanggal rusak diperlakukan TIDAK membatasi, bukan menyembunyikan", () => {
    // Satu baris data salah bentuk tidak boleh menghilangkan pengumuman yang
    // is_active-nya benar. Gerbang utamanya tetap is_active.
    expect(pengumumanTampil(aktif("bukan-tanggal", null), NOW)).toBe(true);
    expect(pengumumanTampil(aktif(null, "juga-bukan"), NOW)).toBe(true);
  });
});

describe("pengumumanTampil — konsistensi timezone", () => {
  it("starts_at yang sama, ditulis dengan offset berbeda, dinilai identik", () => {
    // 10:00 WIB (+07) dan 03:00 UTC (Z) adalah INSTAN yang sama. Keduanya harus
    // memberi keputusan yang persis sama pada NOW, apa pun offset penulisannya.
    const wib = aktif("2026-08-04T10:00:00.000+07:00");
    const utc = aktif("2026-08-04T03:00:00.000Z");
    expect(pengumumanTampil(wib, NOW)).toBe(pengumumanTampil(utc, NOW));
    // dan keduanya inklusif tepat di ujung mulai
    expect(pengumumanTampil(wib, NOW)).toBe(true);
  });

  it("perbandingan membandingkan instan, bukan jam dinding", () => {
    // Berakhir "pukul 09:00 WIB" = 02:00 UTC. Pada NOW (03:00 UTC / 10:00 WIB)
    // sudah lewat, jadi tidak tampil — meski angka jam dindingnya (09 < 10)
    // terlihat "belum" kalau keliru membandingkan teks jam.
    expect(pengumumanTampil(aktif(null, "2026-08-04T09:00:00.000+07:00"), NOW)).toBe(false);
  });

  it("mulai pukul 23:00 WIB tidak tampil pada 10:00 WIB hari yang sama", () => {
    // 23:00 WIB = 16:00 UTC, jauh sesudah NOW (03:00 UTC). Menguji bahwa tidak
    // ada pergeseran tanggal yang membuatnya keliru dianggap sudah mulai.
    expect(pengumumanTampil(aktif("2026-08-04T23:00:00.000+07:00"), NOW)).toBe(false);
  });
});
