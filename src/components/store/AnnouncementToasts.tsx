import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { kindMeta, useAnnouncements } from "@/lib/announcements";

/**
 * Toast saat pengumuman BARU terbit untuk penonton.
 *
 * Bukan komponen visual — memantau useAnnouncements() (polling 60 detik +
 * invalidate saat login/logout) dan memunculkan toast sonner tiap kali sebuah
 * id muncul yang belum pernah dilihat. Server sudah menyaring per audiens, jadi
 * penonton hanya ditoast untuk pengumuman yang memang menyasar dia.
 *
 * PENYEMAIAN WAJIB: pada muat pertama seluruh id yang sudah ada disemai ke
 * himpunan "terlihat" TANPA nge-toast. Tanpa ini, setiap pengumuman aktif akan
 * meledak jadi toast serempak begitu halaman dibuka. Hanya id yang datang
 * SETELAH muat pertama yang memicu toast.
 */
export function AnnouncementToasts() {
  const { data } = useAnnouncements();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;

    if (seen.current === null) {
      seen.current = new Set(data.map((a) => a.id));
      return;
    }

    for (const a of data) {
      if (seen.current.has(a.id)) continue;
      seen.current.add(a.id);
      const Icon = kindMeta(a.kind).icon;
      // Copy netral: judul + pesan pengumuman itu sendiri, bukan menyiratkan
      // "segmen pelanggan" (model audiens kita status-login + role, bukan segmen).
      toast(a.title, {
        description: a.message || undefined,
        icon: <Icon className="h-4 w-4" />,
      });
    }
  }, [data]);

  return null;
}
