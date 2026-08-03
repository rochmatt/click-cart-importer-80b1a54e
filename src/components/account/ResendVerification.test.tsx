import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResendVerification } from "./ResendVerification";

// Indikator cooldown kirim ulang: angka yang ditampilkan HARUS berasal dari
// server, bukan dari tebakan komponen. Tes ini mengunci tiga hal yang mudah
// rusak diam-diam — sumber angkanya, keadaan "maksimal tercapai", dan
// penyelarasan ulang saat hitungan menyentuh nol.
//
// CATATAN TEKNIS: waktu dipalsukan supaya "pukul berapa" bisa diperiksa sebagai
// nilai pasti. Dengan fake timers, waitFor milik Testing Library menggantung —
// ia menunggu timer yang tidak pernah berjalan sendiri. Karena itu penantian di
// sini memakai vi.advanceTimersByTimeAsync, yang memajukan timer SEKALIGUS
// membilas promise yang tertunda.

const { ambilStatus, kirim, toastSukses, toastGagal } = vi.hoisted(() => ({
  ambilStatus: vi.fn(),
  kirim: vi.fn(),
  toastSukses: vi.fn(),
  toastGagal: vi.fn(),
}));

vi.mock("@/lib/auth/auth.functions", () => ({
  verificationCooldown: ambilStatus,
  resendVerification: kirim,
}));

vi.mock("sonner", () => ({
  toast: { success: toastSukses, error: toastGagal },
}));

const EMAIL = "budi@contoh.test";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-03T10:00:00+07:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

/** Memajukan waktu semu sekaligus membilas promise yang tertunda. */
async function majukan(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function pasang(status: { sisaDetik: number; terpakai: number; maks: number }) {
  ambilStatus.mockResolvedValue(status);
  render(<ResendVerification email={EMAIL} />);
  await majukan(0);
}

describe("indikator cooldown kirim ulang verifikasi", () => {
  it("menampilkan hitungan mundur dari angka server, bukan angka sendiri", async () => {
    await pasang({ sisaDetik: 90, terpakai: 2, maks: 5 });

    // Komponen memanggil verificationCooldown({ data: { email } }), bukan
    // dengan email telanjang — bentuk pemanggilan server function.
    expect(ambilStatus).toHaveBeenCalledWith({ data: { email: EMAIL } });
    expect(screen.getByText(/dalam 1m 30s/)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("hitungan mundur benar-benar berjalan", async () => {
    await pasang({ sisaDetik: 90, terpakai: 2, maks: 5 });

    await majukan(30_000);
    expect(screen.getByText(/dalam 1m$/)).toBeInTheDocument();
    expect(screen.queryByText(/1m 30s/)).not.toBeInTheDocument();
  });

  it("menyatakan 'Maksimal tercapai' setelah kuota per jam habis", async () => {
    await pasang({ sisaDetik: 600, terpakai: 5, maks: 5 });

    expect(screen.getByText(/Maksimal tercapai/)).toBeInTheDocument();
    expect(screen.getByText(/5 kiriman dalam satu jam/)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("tunggu panjang menyebut jam dinding", async () => {
    // 600 detik ada di atas ambang, jadi jam dinding ikut ditampilkan.
    // Menghitung sendiri "600 detik dari sekarang" itulah yang ingin dihindari.
    await pasang({ sisaDetik: 600, terpakai: 5, maks: 5 });

    expect(screen.getByText(/pukul/)).toBeInTheDocument();

    // Dihitung dari tanggal, BUKAN dengan memanggil ulang jamKembali — kalau
    // tesnya memakai kode yang sama dengan yang diuji, ia akan tetap lulus
    // walau rumusnya salah. Zona waktu lingkungan tes bukan Asia/Jakarta, jadi
    // angka pastinya tidak boleh ditulis tetap. Pemisah jam bergantung locale.
    const seharusnya = new Date(Date.now() + 600_000);
    const jam = String(seharusnya.getHours()).padStart(2, "0");
    const menit = String(seharusnya.getMinutes()).padStart(2, "0");
    expect(screen.getByText(new RegExp(`${jam}[.:]${menit}`))).toBeInTheDocument();
  });

  it("tunggu pendek hanya menampilkan hitungan mundur", async () => {
    await pasang({ sisaDetik: 45, terpakai: 1, maks: 5 });

    expect(screen.getByText(/dalam 45s/)).toBeInTheDocument();
    expect(screen.queryByText(/pukul/)).not.toBeInTheDocument();
  });

  it("bertanya ulang ke server saat hitungan menyentuh nol", async () => {
    // Inti dari "konsisten lintas perangkat" pada sisi TAMPILAN: angka yang
    // berjalan di browser bisa usang kalau perangkat lain ikut mengirim.
    ambilStatus
      .mockResolvedValueOnce({ sisaDetik: 3, terpakai: 1, maks: 5 })
      .mockResolvedValueOnce({ sisaDetik: 120, terpakai: 2, maks: 5 });

    render(<ResendVerification email={EMAIL} />);
    await majukan(0);
    expect(screen.getByText(/dalam 3s/)).toBeInTheDocument();

    await majukan(3_000);

    expect(ambilStatus).toHaveBeenCalledTimes(2);
    // Jawaban kedua menang: perangkat lain ternyata sudah mengirim.
    expect(screen.getByText(/dalam 2m/)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("tombol aktif dan menyebut sisa kuota saat tidak ada cooldown", async () => {
    await pasang({ sisaDetik: 0, terpakai: 2, maks: 5 });

    expect(screen.getByRole("button")).toBeEnabled();
    expect(screen.getByText(/Sisa 3 kiriman/)).toBeInTheDocument();
  });

  it("angka yang berdetak TIDAK berada di dalam region aria-live", async () => {
    // Region live yang isinya berubah tiap detik akan dibacakan pembaca layar
    // sekali per detik. Ini pernah terjadi: teks hitung mundur berada di dalam
    // tombol ber-aria-live="polite".
    await pasang({ sisaDetik: 90, terpakai: 2, maks: 5 });

    const berdetak = screen.getByText(/dalam 1m 30s/);
    expect(berdetak.closest("[aria-live]")).toBeNull();

    // Sebaliknya, keadaannya tetap diumumkan — hanya tanpa angka berdetak.
    const pengumuman = screen.getByRole("status");
    expect(pengumuman).toHaveAttribute("aria-live", "polite");
    expect(pengumuman.textContent).not.toMatch(/\d+s/);
  });

  it("mengumumkan 'maksimal tercapai' ke pembaca layar", async () => {
    await pasang({ sisaDetik: 600, terpakai: 5, maks: 5 });

    expect(screen.getByRole("status").textContent).toMatch(/Maksimal 5 kiriman per jam tercapai/);
  });
});
