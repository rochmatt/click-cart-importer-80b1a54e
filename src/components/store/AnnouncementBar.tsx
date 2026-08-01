import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  kindMeta,
  useAnnouncements,
  useDismissedAnnouncements,
} from "@/lib/announcements";

const FALLBACK = [
  { id: "fallback-1", kind: "promo", title: "Voucher pengguna baru", message: "Klaim voucher hingga Rp100.000 untuk pesanan pertamamu.", link_url: "", link_label: "" },
  { id: "fallback-2", kind: "info", title: "Gratis ongkir", message: "Gratis ongkir seluruh Indonesia tanpa minimum belanja.", link_url: "", link_label: "" },
];

/**
 * Rotating store-wide banner for promos, info and warnings.
 * Content is managed from Admin → Announcements; each item can be dismissed.
 */
export function AnnouncementBar() {
  const { data } = useAnnouncements();
  const { dismissedIds, dismiss } = useDismissedAnnouncements();
  const [i, setI] = useState(0);

  const items = (data && data.length > 0 ? data : FALLBACK)
    .filter((a) => ("show_as_banner" in a ? a.show_as_banner : true))
    .filter((a) => !dismissedIds.includes(a.id));

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[i % items.length];
  const meta = kindMeta(current.kind);
  const Icon = meta.icon;

  return (
    <div className="text-primary-foreground" style={{ backgroundImage: "var(--gradient-flash)" }}>
      <div className="mx-auto flex h-9 max-w-7xl items-center gap-2 px-4">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <p
          key={current.id}
          className="animate-in fade-in slide-in-from-bottom-1 min-w-0 flex-1 truncate text-center text-[11px] font-semibold tracking-tight sm:text-xs"
        >
          <span className="font-extrabold">{current.title}</span>
          {current.message ? <span className="opacity-90"> — {current.message}</span> : null}
          {current.link_url ? (
            <a
              href={current.link_url}
              className="ml-2 whitespace-nowrap underline underline-offset-2"
            >
              {current.link_label || "Lihat"}
            </a>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => dismiss(current.id)}
          aria-label="Tutup pemberitahuan"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors hover:bg-primary-foreground/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
