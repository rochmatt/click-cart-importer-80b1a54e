import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { resendVerification, verificationCooldown } from "@/lib/auth/auth.functions";

// SUMBER KEBENARAN ADA DI SERVER.
//
// Versi sebelumnya menyimpan cooldown dan jumlah kiriman di localStorage. Itu
// membuat batasnya berbeda di tiap perangkat dan hilang begitu data browser
// dibersihkan — sementara server memakai angka lain lagi (3/jam, tanpa
// cooldown) di memori proses yang hilang tiap restart. Akibatnya tombol ini
// bisa mengatakan "2 kiriman tersisa" padahal server sudah berhenti mengirim,
// dan tetap menampilkan notifikasi berhasil.
//
// Sekarang komponen ini tidak memutuskan apa pun. Ia menampilkan angka yang
// diberikan server dan menghitung mundur secara lokal di antara dua jawaban.

interface Kuota {
  /**
   * Kapan tombol boleh dipakai lagi, sebagai waktu absolut — bukan sisa detik
   * yang dikurangi tiap interval. Browser memperlambat timer pada tab yang
   * tidak aktif, sehingga hitungan mundur berbasis pengurangan akan tertinggal
   * dan menampilkan angka yang lebih besar dari kenyataan.
   */
  bolehPada: number;
  terpakai: number;
  maks: number;
}

/** Hanya dipakai saat status gagal dibaca; angka sebenarnya selalu dari server. */
const MAKS_BAWAAN = 5;

function formatSisa(detik: number): string {
  if (detik >= 60) {
    const menit = Math.floor(detik / 60);
    const sisa = detik % 60;
    return sisa ? `${menit}m ${sisa}s` : `${menit}m`;
  }
  return `${detik}s`;
}

export function ResendVerification({ email }: { email: string }) {
  const [kuota, setKuota] = useState<Kuota | null>(null);
  const [sisa, setSisa] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  const berjalan = useRef(false);

  // Status awal diambil dari server, bukan dari penyimpanan browser — inilah
  // yang membuat cooldown ikut terbawa saat pengguna berpindah perangkat.
  useEffect(() => {
    let batal = false;
    if (!email) return;
    void verificationCooldown({ data: { email } })
      .then((s) => {
        if (!batal) setKuota({ bolehPada: Date.now() + s.sisaDetik * 1000, ...s });
      })
      .catch(() => {
        // Gagal membaca status bukan alasan menyembunyikan tombol. Kalau
        // ternyata masih dalam cooldown, server yang akan menolaknya.
        if (!batal) setKuota({ bolehPada: 0, terpakai: 0, maks: MAKS_BAWAAN });
      });
    return () => {
      batal = true;
    };
  }, [email]);

  // Hitung mundur hanya untuk tampilan; penegakannya tetap di server.
  useEffect(() => {
    if (!kuota) return;
    const hitung = () => setSisa(Math.max(0, Math.ceil((kuota.bolehPada - Date.now()) / 1000)));
    hitung();
    const id = window.setInterval(hitung, 1000);
    return () => window.clearInterval(id);
  }, [kuota]);

  const kuotaHabis = kuota ? kuota.terpakai >= kuota.maks && sisa > 0 : false;
  const terkunci = sibuk || sisa > 0 || kuota === null;

  const kirimUlang = useCallback(async () => {
    if (!email || berjalan.current) return;
    berjalan.current = true;
    setSibuk(true);
    try {
      const hasil = await resendVerification({ data: { email } });
      setKuota({
        bolehPada: Date.now() + hasil.sisaDetik * 1000,
        terpakai: hasil.terpakai,
        maks: hasil.maks,
      });

      // diizinkan berarti PEMBATAS meloloskan percobaan ini — bukan bahwa email
      // pasti terkirim. Apakah akunnya ada dan belum terverifikasi sengaja tidak
      // pernah dilaporkan, jadi pesan sukses ditulis netral.
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
  }, [email]);

  const tersisa = kuota ? Math.max(0, kuota.maks - kuota.terpakai) : 0;

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
        disabled={terkunci}
        aria-live="polite"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
      >
        {sibuk && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {kuota === null
          ? "Memeriksa…"
          : kuotaHabis
            ? `Batas tercapai — coba lagi dalam ${formatSisa(sisa)}`
            : sisa > 0
              ? `Kirim ulang tersedia dalam ${formatSisa(sisa)}`
              : "Kirim ulang email verifikasi"}
      </button>
      {kuota !== null && tersisa > 0 && tersisa < kuota.maks && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sisa {tersisa} kiriman dalam satu jam ke depan. Batas ini berlaku untuk semua perangkat.
        </p>
      )}
    </div>
  );
}
