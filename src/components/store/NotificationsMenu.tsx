import { useState } from "react";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { kindMeta, useAnnouncements, useReadAnnouncements } from "@/lib/announcements";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

/** Bell menu listing every live announcement: promo, info, warning, maintenance. */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const { data } = useAnnouncements();
  const { readIds, markRead } = useReadAnnouncements();

  const items = data ?? [];
  const unread = items.filter((a) => !readIds.includes(a.id));

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && unread.length > 0) markRead(unread.map((a) => a.id));
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            unread.length > 0 ? `Pemberitahuan, ${unread.length} belum dibaca` : "Pemberitahuan"
          }
          className="relative grid h-10 w-10 place-items-center rounded-full text-header-muted transition-colors hover:bg-header-foreground/10 hover:text-primary"
        >
          {unread.length > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-bold text-foreground">Pemberitahuan</p>
          {items.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCheck className="h-3.5 w-3.5" />
              {unread.length > 0 ? `${unread.length} baru` : "Semua terbaca"}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Belum ada pemberitahuan.
          </p>
        ) : (
          <ul className="max-h-[22rem] overflow-y-auto py-1">
            {items.map((a) => {
              const meta = kindMeta(a.kind);
              const Icon = meta.icon;
              const isUnread = !readIds.includes(a.id);
              return (
                <li key={a.id}>
                  <div className="flex gap-3 px-3 py-2.5 transition-colors hover:bg-accent/60">
                    <span
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.className}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                        {isUnread && (
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.message}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className={`rounded-full px-1.5 py-0.5 font-semibold ${meta.className}`}>
                          {meta.label}
                        </span>
                        <span>{timeAgo(a.created_at)}</span>
                        {a.link_url && (
                          <a
                            href={a.link_url}
                            className="ml-auto font-semibold text-primary hover:underline"
                          >
                            {a.link_label || "Lihat"}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
