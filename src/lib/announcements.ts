import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Info, AlertTriangle, Wrench } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AnnouncementKind = "promo" | "info" | "warning" | "maintenance";

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
  created_at: string;
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

const SELECT =
  "id, title, message, kind, link_url, link_label, show_as_banner, priority, is_active, starts_at, ends_at, created_at";

/** Active, in-window announcements. RLS already filters schedule + active flag. */
export async function fetchLiveAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select(SELECT)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export const ANNOUNCEMENTS_KEY = ["announcements", "live"] as const;

/* ---------- realtime: one shared channel for all subscribers ---------- */

let channel: RealtimeChannel | null = null;
let subscribers = 0;

function useAnnouncementsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
    };

    subscribers += 1;
    if (!channel) {
      channel = supabase
        .channel("announcements-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "announcements" },
          invalidate,
        )
        .subscribe();
    } else {
      // A later mount joins the existing channel; refresh once to catch up.
      invalidate();
    }

    return () => {
      subscribers -= 1;
      if (subscribers <= 0 && channel) {
        supabase.removeChannel(channel);
        channel = null;
        subscribers = 0;
      }
    };
  }, [queryClient]);
}

export function useAnnouncements() {
  useAnnouncementsRealtime();
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
