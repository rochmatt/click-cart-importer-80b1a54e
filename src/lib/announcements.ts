import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Info, AlertTriangle, Wrench } from "lucide-react";
import { fetchAnnouncements } from "@/lib/content.functions";
import type { AudiensPengumuman } from "@/lib/announcement-window";
import { useAuth } from "@/lib/auth";

export type AnnouncementKind = "promo" | "info" | "warning" | "maintenance";
export type AnnouncementAudience = AudiensPengumuman;

export interface Announcement {
  id: string;
  title: string;
  message: string;
  kind: AnnouncementKind;
  link_url: string;
  link_label: string;
  show_as_banner: boolean;
  priority: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  audience: AnnouncementAudience;
  created_at: string;
}

/**
 * Label audiens. `label` untuk panel admin (jelas & panjang), `short` untuk pill
 * badge sempit di storefront. Urutan objek = urutan yang ditampilkan.
 */
export const AUDIENCE_META: Record<
  AnnouncementAudience,
  { label: string; short: string; hint: string }
> = {
  all: { label: "Semua", short: "Semua", hint: "Tampil ke semua pengunjung" },
  guest: { label: "Tamu (belum login)", short: "Tamu", hint: "Hanya yang belum masuk akun" },
  member: { label: "Member (sudah login)", short: "Member", hint: "Hanya pengunjung yang login" },
  admin: { label: "Admin", short: "Admin", hint: "Hanya penonton berperan admin" },
  moderator: { label: "Moderator", short: "Moderator", hint: "Hanya penonton berperan moderator" },
};

/** Label pendek satu audiens; jatuh ke "Semua" untuk nilai tak dikenal. */
export function audienceMeta(audience: string) {
  return AUDIENCE_META[
    (audience as AnnouncementAudience) in AUDIENCE_META ? (audience as AnnouncementAudience) : "all"
  ];
}

export const KIND_META: Record<
  AnnouncementKind,
  { label: string; icon: typeof Info; className: string; dot: string }
> = {
  promo: {
    label: "Promo",
    icon: BadgePercent,
    className: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  info: {
    label: "Info",
    icon: Info,
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  warning: {
    label: "Peringatan",
    icon: AlertTriangle,
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  maintenance: {
    label: "Pemeliharaan",
    icon: Wrench,
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

export function kindMeta(kind: string) {
  return KIND_META[(kind as AnnouncementKind) in KIND_META ? (kind as AnnouncementKind) : "info"];
}

/**
 * Pengumuman aktif yang sedang dalam jendela jadwalnya.
 *
 * Penyaringan jadwal + status aktif dilakukan server di fetchAnnouncements
 * (lihat pengumumanTampil di announcement-window.ts) — BUKAN oleh RLS. Policy
 * announce_read hanya membuka baca publik tanpa menyaring jadwal; klien tinggal
 * meneruskan hasil yang sudah tersaring.
 */
export async function fetchLiveAnnouncements(): Promise<Announcement[]> {
  return (await fetchAnnouncements()) as unknown as Announcement[];
}

export const ANNOUNCEMENTS_KEY = ["announcements", "live"] as const;

/* ---------- penyegaran berkala ---------- */

/**
 * PostgreSQL polos tidak punya padanan Realtime Supabase, jadi langganan
 * postgres_changes diganti penyegaran berkala.
 *
 * Konsekuensinya jujur: pengumuman baru muncul paling lama satu menit setelah
 * disimpan, bukan seketika. Untuk banner toko itu memadai, dan menambah
 * WebSocket sendiri demi selisih itu tidak sepadan.
 */
function useAnnouncementsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
    }, 60_000);
    return () => clearInterval(id);
  }, [queryClient]);
}

/**
 * Hasil fetchAnnouncements kini bergantung pada sesi (audience targeting), jadi
 * cache tamu vs member berbeda. Saat identitas berubah (login/logout) segarkan
 * segera alih-alih menunggu polling 60 detik — kalau tidak, banner "member"
 * baru muncul semenit setelah masuk, dan banner "tamu" masih menempel semenit
 * setelah keluar.
 */
function useAnnouncementsAuthSync() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
  }, [queryClient, userId]);
}

export function useAnnouncements() {
  useAnnouncementsRealtime();
  useAnnouncementsAuthSync();
  return useQuery({
    queryKey: ANNOUNCEMENTS_KEY,
    queryFn: fetchLiveAnnouncements,
    staleTime: 30_000,
    // Scheduled announcements go live without any DB event, so poll lightly too.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/* ---------- local read / dismiss state ---------- */

const READ_KEY = "pasarpilih:announcements:read";
const DISMISSED_KEY = "pasarpilih:announcements:dismissed";

function readIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids.slice(-200)));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event("pasarpilih:announcements"));
}

function useIdSet(key: string) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(readIds(key));
    sync();
    window.addEventListener("pasarpilih:announcements", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pasarpilih:announcements", sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  const add = (id: string | string[]) => {
    const next = Array.from(new Set([...readIds(key), ...(Array.isArray(id) ? id : [id])]));
    writeIds(key, next);
    setIds(next);
  };

  return { ids, add };
}

export function useReadAnnouncements() {
  const { ids, add } = useIdSet(READ_KEY);
  return { readIds: ids, markRead: add };
}

export function useDismissedAnnouncements() {
  const { ids, add } = useIdSet(DISMISSED_KEY);
  return { dismissedIds: ids, dismiss: add };
}
