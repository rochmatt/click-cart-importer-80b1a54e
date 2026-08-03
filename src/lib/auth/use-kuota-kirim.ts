import { useCallback, useEffect, useRef, useState } from "react";

// Hitung mundur dan status kuota kirim email, dipakai bersama oleh kirim-ulang
// verifikasi dan permintaan reset password.
//
// Disatukan karena keduanya menghadapi persoalan yang sama persis, dan versi
// terpisah sudah terbukti melenceng satu sama lain: sebelum ini yang satu
// memakai localStorage 5/jam bertingkat sementara yang lain memakai state React
// 60 detik datar, padahal server memberlakukan aturan yang sama untuk keduanya.

export interface StatusKuota {
  sisaDetik: number;
  terpakai: number;
  maks: number;
}

export interface KuotaKirim {
  /** null selama status pertama belum sampai. */
  status: StatusKuota | null;
  /** Sisa detik, dihitung dari jam dinding — bukan pengurangan tiap tik. */
  sisa: number;
  /** Kuota jendela sudah habis, bukan sekadar sedang menunggu cooldown. */
  maksTercapai: boolean;
  /** Tombol boleh dipakai. */
  siap: boolean;
  /** Dipanggil dengan jawaban server setelah pengiriman, untuk menyegerakan tampilan. */
  terapkan: (s: StatusKuota) => void;
}

/**
 * @param ambil  Pengambil status dari server. Dibungkus useCallback oleh pemanggil.
 * @param email  Alamat yang sedang ditanyakan; kosong berarti belum perlu bertanya.
 */
export function useKuotaKirim(
  ambil: (email: string) => Promise<StatusKuota>,
  email: string,
): KuotaKirim {
  const [status, setStatus] = useState<StatusKuota | null>(null);
  const [bolehPada, setBolehPada] = useState(0);
  const [sisa, setSisa] = useState(0);

  // Menahan permintaan ganda saat countdown menyentuh nol sementara permintaan
  // penyelarasan sebelumnya belum kembali.
  const menyelaraskan = useRef(false);

  // Menandai bahwa ada hitungan mundur berjalan yang PANTAS diselaraskan ulang
  // begitu habis. Tanpa penanda ini, efek penyelarasan di bawah menyala di dua
  // keadaan yang salah: sesaat setelah terapkan (sisa masih nilai lama, yaitu
  // nol, sementara status sudah terisi) dan berulang-ulang setelah jawaban
  // sisaDetik = 0, karena syarat "sudah lewat waktunya" selalu benar.
  const perluSelaras = useRef(false);

  const terapkan = useCallback((s: StatusKuota) => {
    setStatus(s);
    // sisa disetel serentak dengan bolehPada. Membiarkannya menunggu efek
    // hitung mundur menyisakan satu render dengan nilai lama — dan render itu
    // yang dulu memicu permintaan tambahan ke server setiap kali tombol dipakai.
    setSisa(s.sisaDetik);
    setBolehPada(Date.now() + s.sisaDetik * 1000);
    perluSelaras.current = s.sisaDetik > 0;
  }, []);

  const selaraskan = useCallback(async () => {
    if (!email || menyelaraskan.current) return;
    menyelaraskan.current = true;
    try {
      terapkan(await ambil(email));
    } catch {
      // Gagal membaca status bukan alasan mengunci tombol selamanya. Kalau
      // ternyata masih dalam cooldown, server yang menolak — penegakannya
      // memang tidak pernah ada di sini.
      setStatus((s) => s ?? { sisaDetik: 0, terpakai: 0, maks: 5 });
    } finally {
      menyelaraskan.current = false;
    }
  }, [ambil, email, terapkan]);

  useEffect(() => {
    void selaraskan();
  }, [selaraskan]);

  useEffect(() => {
    const hitung = () => setSisa(Math.max(0, Math.ceil((bolehPada - Date.now()) / 1000)));
    hitung();
    if (bolehPada <= Date.now()) return;
    const id = window.setInterval(hitung, 1000);
    return () => window.clearInterval(id);
  }, [bolehPada]);

  // PENYELARASAN ULANG SAAT HITUNGAN HABIS. Angka yang ditampilkan berasal dari
  // satu jawaban server lalu berjalan sendiri di browser. Kalau perangkat lain
  // ikut mengirim selama itu, hitungan di sini sudah usang dan tombolnya akan
  // menyala padahal server pasti menolak. Bertanya sekali saat menyentuh nol
  // memulihkan kesesuaiannya — inilah yang membuat "konsisten lintas perangkat"
  // berlaku juga pada apa yang DILIHAT pengguna, bukan hanya pada penegakannya.
  //
  // Tepat sekali per hitungan mundur: penandanya dimatikan sebelum permintaan
  // dikirim, dan hanya dinyalakan lagi oleh terapkan dengan sisaDetik > 0.
  useEffect(() => {
    if (!perluSelaras.current || sisa > 0) return;
    perluSelaras.current = false;
    void selaraskan();
  }, [sisa, selaraskan]);

  const maksTercapai = Boolean(status && status.terpakai >= status.maks && sisa > 0);

  return {
    status,
    sisa,
    maksTercapai,
    siap: status !== null && sisa === 0,
    terapkan,
  };
}

/** "2m 5s", "45s" — satuan jam tidak dipakai karena jendelanya memang satu jam. */
export function formatSisa(detik: number): string {
  if (detik >= 60) {
    const menit = Math.floor(detik / 60);
    const sisa = detik % 60;
    return sisa ? `${menit}m ${sisa}s` : `${menit}m`;
  }
  return `${detik}s`;
}

/**
 * Jam dinding kapan tombol bisa dipakai lagi, untuk tunggu yang panjang.
 *
 * Di atas beberapa menit, "coba lagi dalam 47m" menuntut orang menghitung
 * sendiri, dan angkanya berubah terus sehingga tidak bisa diingat. Pukul
 * berapa jauh lebih mudah dipakai. Di bawah lima menit sebaliknya: jam dinding
 * terasa berlebihan untuk tunggu yang sebentar.
 */
export const AMBANG_JAM_DINDING_DETIK = 5 * 60;

export function jamKembali(detikDariSekarang: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Date.now() + detikDariSekarang * 1000));
}
