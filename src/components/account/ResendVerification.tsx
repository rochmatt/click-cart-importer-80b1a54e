import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { resendVerification, verificationCooldown } from "@/lib/auth/auth.functions";
import {
  AMBANG_JAM_DINDING_DETIK,
  formatSisa,
  jamKembali,
  useKuotaKirim,
} from "@/lib/auth/use-kuota-kirim";

// SUMBER KEBENARAN ADA DI SERVER.
//
// Versi sebelumnya menyimpan cooldown dan jumlah kiriman di localStorage. Itu
// membuat batasnya berbeda di tiap perangkat dan hilang begitu data browser
// dibersihkan — sementara server memakai angka lain lagi di memori proses yang
// hilang tiap restart. Akibatnya tombol ini bisa mengatakan "2 kiriman tersisa"
// padahal server sudah berhenti mengirim, dan tetap menampilkan notifikasi
// berhasil.
//
// Komponen ini tidak memutuskan apa pun. Ia menampilkan angka dari server dan
// menghitung mundur di antara dua jawaban.

const ambilStatus = (email: string) => verificationCooldown({ data: { email } });

export function ResendVerification({ email }: { email: string }) {
  const kuota = useKuotaKirim(ambilStatus, email);
  const [sibuk, setSibuk] = useState(false);
  const berjalan = useRef(false);

  const kirimUlang = useCallback(async () => {
    if (!email || berjalan.current) return;
    berjalan.current = true;
    setSibuk(true);
    try {
      const hasil = await resendVerification({ data: { email } });
      kuota.terapkan(hasil);

      // diizinkan berarti PEMBATAS meloloskan percobaan ini — bukan bahwa email
      // pasti terkirim. Apakah akunnya ada dan belum terverifikasi sengaja tidak
      // pernah dilaporkan, jadi pesan suksesnya ditulis netral.
      if (hasil.diizinkan) {
        toast.success(
          `Kalau alamat itu terdaftar dan belum terverifikasi, emailnya sudah dikirim. Bisa minta lagi dalam ${formatSisa(hasil.sisaDetik)}.`,
        );
      } else if (hasil.terpakai >= hasil.maks) {
        toast.error(`Batas kirim ulang tercapai. Coba lagi dalam ${formatSisa(hasil.sisaDetik)}.`);
      } else {
        toast.error(`Tunggu ${formatSisa(hasil.sisaDetik)} sebelum meminta email lagi.`);
      }
    } catch {
      toast.error("Gagal mengirim. Coba lagi sebentar lagi.");
    } finally {
      berjalan.current = false;
      setSibuk(false);
    }
  }, [email, kuota]);

  const { status, sisa, maksTercapai, siap } = kuota;
  const tersisa = status ? Math.max(0, status.maks - status.terpakai) : 0;
  const panjang = sisa >= AMBANG_JAM_DINDING_DETIK;

  return (
    <div className="rounded-2xl border border-chart-4/40 bg-chart-4/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldAlert className="h-4 w-4 text-chart-4" />
        Confirm your email address
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        We sent a verification link to {email}. Confirm it to secure your account and receive order
        updates.
      </p>

      <button
        type="button"
        onClick={() => void kirimUlang()}
        disabled={sibuk || !siap}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
      >
        {sibuk && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {status === null ? "Memeriksa…" : siap ? "Kirim ulang email verifikasi" : "Menunggu…"}
      </button>

      {/*
        Hitungan mundur ditaruh DI LUAR tombol dan TANPA aria-live. Sebelumnya
        teksnya ada di dalam tombol ber-aria-live="polite" dan berubah tiap
        detik, sehingga pembaca layar membacakannya sekali per detik — praktis
        menutupi seluruh halaman. Perubahan keadaan yang benar-benar layak
        diumumkan ditangani region terpisah di bawah.
      */}
      {status !== null && !siap && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {maksTercapai ? (
            <>
              <span className="font-semibold text-foreground">Maksimal tercapai</span> —{" "}
              {status.maks} kiriman dalam satu jam.{" "}
            </>
          ) : (
            "Bisa kirim ulang "
          )}
          {panjang ? (
            <>
              Coba lagi sekitar pukul <span className="font-medium">{jamKembali(sisa)}</span>{" "}
              <span className="tabular-nums">({formatSisa(sisa)} lagi)</span>
            </>
          ) : (
            <span className="tabular-nums font-medium">dalam {formatSisa(sisa)}</span>
          )}
        </p>
      )}

      {status !== null && siap && tersisa > 0 && tersisa < status.maks && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sisa {tersisa} kiriman dalam satu jam ke depan.
        </p>
      )}

      {status !== null && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Batas ini berlaku untuk semua perangkat.
        </p>
      )}

      {/*
        Diumumkan hanya saat KEADAANNYA berubah, bukan tiap detik: isinya tidak
        memuat angka yang berdetak.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {status === null
          ? "Memeriksa status kirim ulang"
          : maksTercapai
            ? `Maksimal ${status.maks} kiriman per jam tercapai. Tombol kirim ulang tidak aktif.`
            : siap
              ? "Tombol kirim ulang aktif."
              : "Menunggu jeda sebelum kirim ulang berikutnya."}
      </p>
    </div>
  );
}
