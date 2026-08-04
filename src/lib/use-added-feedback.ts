import { useCallback, useRef, useState } from "react";

// Umpan balik "ditambahkan ke keranjang" yang terlihat DI TOMBOLNYA sendiri.
//
// Sebelumnya menekan Add to Cart hanya memunculkan toast; tombolnya tidak
// berubah sama sekali. Toast mudah terlewat — muncul di sudut, hilang sendiri —
// dan tanpa perubahan pada tombol yang ditekan, orang ragu apakah kliknya
// masuk lalu menekannya lagi. Ikon yang berubah jadi centang tepat di bawah jari
// menjawab "iya, masuk" tanpa perlu mata berpindah.
//
// State ditaruh di hook, bukan di komponen tombol, karena halaman detail punya
// DUA tombol tambah — desktop dan bar sticky ponsel — yang keduanya harus
// menampilkan konfirmasi yang sama saat salah satunya ditekan.

const DURASI_MS = 1500;

export function useAddedFeedback(): { added: boolean; tandai: () => void } {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tandai = useCallback(() => {
    setAdded(true);
    // Timer sebelumnya dibatalkan supaya klik beruntun tidak menumpuk dan
    // membuat centang berkedip lebih cepat dari yang seharusnya.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), DURASI_MS);
  }, []);

  return { added, tandai };
}
