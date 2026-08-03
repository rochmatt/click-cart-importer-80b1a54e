import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import {
  adminDeleteAnnouncement,
  adminListAnnouncements,
  adminSaveAnnouncement,
} from "@/lib/content.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { type Announcement, KIND_META, kindMeta } from "@/lib/announcements";

const title = "Announcements — PasarPilih Admin";
const description =
  "Create promo, info, warning and maintenance notices for the PasarPilih storefront.";

export const Route = createFileRoute("/admin/announcements")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAnnouncementsPage,
});

type Draft = {
  title: string;
  message: string;
  kind: string;
  link_url: string;
  link_label: string;
  show_as_banner: boolean;
  priority: number;
  ends_at: string;
};

const emptyDraft: Draft = {
  title: "",
  message: "",
  kind: "promo",
  link_url: "",
  link_label: "",
  show_as_banner: true,
  priority: 10,
  ends_at: "",
};

function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const listQuery = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: async () => (await adminListAnnouncements()) as unknown as Announcement[],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    queryClient.invalidateQueries({ queryKey: ["announcements", "live"] });
  };

  const createMutation = useMutation({
    mutationFn: async (input: Draft) => {
      // Server memvalidasi payload dengan skema ketat, jadi kolom yang tidak
      // dikenal ditolak alih-alih diam-diam tertulis.
      await adminSaveAnnouncement({
        data: {
          id: null,
          payload: {
            title: input.title.trim(),
            message: input.message.trim(),
            kind: input.kind,
            link_url: input.link_url.trim(),
            link_label: input.link_label.trim(),
            show_as_banner: input.show_as_banner,
            priority: Number.isFinite(input.priority) ? input.priority : 0,
            is_active: true,
            starts_at: new Date().toISOString(),
            ends_at: input.ends_at ? new Date(input.ends_at).toISOString() : null,
          },
        },
      });
    },
    onSuccess: () => {
      setDraft(emptyDraft);
      invalidate();
      toast.success("Pemberitahuan dibuat");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Gagal membuat pemberitahuan"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Announcement> }) => {
      const kini = (listQuery.data ?? []).find((a) => a.id === id);
      if (!kini) throw new Error("Pemberitahuan tidak ditemukan");
      // Skema server bersifat strict dan menuntut seluruh kolom, jadi patch
      // digabung ke nilai yang sedang tampil.
      await adminSaveAnnouncement({
        data: {
          id,
          payload: {
            title: patch.title ?? kini.title,
            message: patch.message ?? kini.message,
            kind: patch.kind ?? kini.kind,
            link_url: patch.link_url ?? kini.link_url,
            link_label: patch.link_label ?? kini.link_label,
            show_as_banner: patch.show_as_banner ?? kini.show_as_banner,
            priority: patch.priority ?? kini.priority,
            is_active: patch.is_active ?? kini.is_active,
            starts_at: patch.starts_at ?? kini.starts_at,
            ends_at: patch.ends_at ?? kini.ends_at ?? null,
          },
        },
      });
    },
    onSuccess: () => invalidate(),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Gagal memperbarui"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminDeleteAnnouncement({ data: id });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pemberitahuan dihapus");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Gagal menghapus"),
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-foreground">
          <Megaphone className="h-5 w-5 text-primary" />
          Announcements
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola pemberitahuan promo, info, peringatan dan pemeliharaan yang tampil di toko.
        </p>
      </header>

      <form
        className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.title.trim()) {
            toast.error("Judul wajib diisi");
            return;
          }
          createMutation.mutate(draft);
        }}
      >
        <div className="sm:col-span-2">
          <Label htmlFor="a-title">Judul</Label>
          <Input
            id="a-title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Voucher pengguna baru Rp100.000"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="a-message">Pesan</Label>
          <Textarea
            id="a-message"
            rows={2}
            value={draft.message}
            onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            placeholder="Berlaku untuk semua kategori sampai akhir bulan."
          />
        </div>

        <div>
          <Label htmlFor="a-kind">Jenis</Label>
          <select
            id="a-kind"
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {Object.entries(KIND_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="a-priority">Prioritas</Label>
          <Input
            id="a-priority"
            type="number"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="a-link">Tautan (opsional)</Label>
          <Input
            id="a-link"
            value={draft.link_url}
            onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
            placeholder="/search"
          />
        </div>

        <div>
          <Label htmlFor="a-link-label">Label tautan</Label>
          <Input
            id="a-link-label"
            value={draft.link_label}
            onChange={(e) => setDraft({ ...draft, link_label: e.target.value })}
            placeholder="Klaim sekarang"
          />
        </div>

        <div>
          <Label htmlFor="a-ends">Berakhir pada (opsional)</Label>
          <Input
            id="a-ends"
            type="datetime-local"
            value={draft.ends_at}
            onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3 sm:pt-6">
          <Switch
            id="a-banner"
            checked={draft.show_as_banner}
            onCheckedChange={(v) => setDraft({ ...draft, show_as_banner: v })}
          />
          <Label htmlFor="a-banner" className="cursor-pointer">
            Tampilkan sebagai banner atas
          </Label>
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Tambah pemberitahuan
          </Button>
        </div>
      </form>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-foreground">Daftar pemberitahuan</h2>

        {listQuery.isLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </p>
        ) : (listQuery.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Belum ada pemberitahuan.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {(listQuery.data ?? []).map((a) => {
              const meta = kindMeta(a.kind);
              const Icon = meta.icon;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${meta.className}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {meta.label} · prioritas {a.priority}
                      {a.show_as_banner ? " · banner" : ""}
                      {a.ends_at
                        ? ` · berakhir ${new Date(a.ends_at).toLocaleString("id-ID")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={a.is_active}
                      aria-label={`Aktifkan ${a.title}`}
                      onCheckedChange={(v) =>
                        updateMutation.mutate({ id: a.id, patch: { is_active: v } })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {a.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${a.title}`}
                      onClick={() => deleteMutation.mutate(a.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
