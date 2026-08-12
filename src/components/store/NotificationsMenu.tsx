import { useState } from "react";
import { useHoverMenu } from "@/lib/use-hover-menu";
import { Activity, Bell, BellRing, CheckCheck, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  type Announcement,
  audienceMeta,
  kindMeta,
  useAnnouncements,
  useReadAnnouncements,
} from "@/lib/announcements";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

/** "12 Agustus 2026, 10.00 WIB" — waktu mulai dalam zona toko (WIB). */
function formatMulai(iso: string) {
  return (
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date(iso)) + " WIB"
  );
}

/** Bell menu listing every live announcement; klik satu untuk detail penuh. */
export function NotificationsMenu() {
  const [selected, setSelected] = useState<Announcement | null>(null);
  const { data } = useAnnouncements();
  const { readIds, markRead } = useReadAnnouncements();

  const items = data ?? [];
  const unread = items.filter((a) => !readIds.includes(a.id));

  // Buka saat hover (seperti mega menu). markRead saat hover membuka.
  const { open, setOpen, triggerHoverProps, contentHoverProps } = useHoverMenu(() => {
    if (unread.length > 0) markRead(unread.map((a) => a.id));
  });

  // Membuka satu pengumuman: tutup dropdown dulu (hindari dua modal bertumpuk),
  // lalu buka Sheet detail dan tandai terbaca.
  const openDetail = (a: Announcement) => {
    setOpen(false);
    setSelected(a);
    markRead([a.id]);
  };

  const selMeta = selected ? kindMeta(selected.kind) : null;
  const showSelAudience = Boolean(selected && selected.audience);

  return (
    <>
      <DropdownMenu
        modal={false}
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
            {...triggerHoverProps}
            className="relative grid h-10 w-10 place-items-center rounded-full text-header-muted transition-colors hover:bg-header-foreground/10 hover:text-primary"
          >
            {unread.length > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            {unread.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-destructive-foreground">
                {unread.length > 99 ? "99+" : unread.length}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[min(22rem,calc(100vw-1.5rem))] p-0"
          {...contentHoverProps}
        >
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
                const showAudience = Boolean(a.audience);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => openDetail(a)}
                      className="flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/60"
                    >
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.className}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {a.title}
                          </p>
                          {isUnread && (
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {a.message}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span
                            className={`rounded-full px-1.5 py-0.5 font-semibold ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                          {showAudience && (
                            <span className="rounded-full bg-secondary px-1.5 py-0.5 font-semibold text-secondary-foreground">
                              {audienceMeta(a.audience).short}
                            </span>
                          )}
                          <span className="ml-auto">{timeAgo(a.created_at)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Drawer detail — di luar DropdownMenuContent supaya tidak ikut ter-unmount
          saat dropdown menutup. */}
      <Sheet open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          {selected && selMeta && (
            <>
              <SheetHeader className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`border-transparent ${selMeta.className}`}>
                    {selMeta.label}
                  </Badge>
                  {showSelAudience && (
                    <Badge variant="secondary">{audienceMeta(selected.audience).short}</Badge>
                  )}
                </div>
                <SheetTitle className="text-lg font-extrabold leading-snug">
                  {selected.title}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-2 rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Waktu mulai:{" "}
                    <strong className="text-foreground">{formatMulai(selected.starts_at)}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Status: <strong className="text-foreground">Sedang berjalan</strong>
                  </span>
                </div>
              </div>

              <SheetDescription className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {selected.message}
              </SheetDescription>

              {selected.link_url && (
                <SheetFooter className="mt-auto pt-6">
                  <a
                    href={selected.link_url}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
                  >
                    {selected.link_label || "Lihat selengkapnya"}
                  </a>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
