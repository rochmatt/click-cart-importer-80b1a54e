import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  RefreshCw,
  Eye,
  EyeOff,
  Pencil,
  AlertTriangle,
  PackageCheck,
  CircleSlash,
  Clock,
} from "lucide-react";
import {
  listProductSync,
  syncProductNow,
  runSyncBatch,
  type ProductSyncRow,
} from "@/lib/product-sync.functions";
import { adminSetStatus } from "@/lib/admin-products.functions";
import { formatRupiah } from "@/lib/admin-store";
import { tierLabel } from "@/lib/product-sync";

export const Route = createFileRoute("/admin/sync")({
  head: () => ({
    meta: [
      { title: "Sinkronisasi Produk — PasarPilih Admin" },
      {
        name: "description",
        content:
          "Pantau stok & harga produk marketplace: yang habis, harga berubah, atau gagal disinkron.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SyncDashboard,
});

const SYNC_KEY = ["product-sync"] as const;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-tokopedia/10 text-tokopedia" },
  out_of_stock: { label: "Stok habis", cls: "bg-destructive/10 text-destructive" },
  margin_loss: { label: "Rugi (disembunyikan)", cls: "bg-destructive/10 text-destructive" },
  error: { label: "Gagal", cls: "bg-muted text-[var(--chart-4)]" },
  idle: { label: "Belum dicek", cls: "bg-muted text-muted-foreground" },
};

function lastChecked(iso: string | null): string {
  if (!iso) return "belum pernah";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: localeId });
  } catch {
    return "—";
  }
}

/** Badge margin: Rugi (modal ≥ jual) / margin% (+ "tipis" bila < 15%). */
function marginBadge(cost: number | null, selling: number | null) {
  if (cost == null || selling == null) return null;
  if (cost >= selling) {
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        Rugi
      </span>
    );
  }
  const markup = Math.round(((selling - cost) / cost) * 100);
  const tipis = markup < 15;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        tipis ? "bg-muted text-[var(--chart-4)]" : "bg-tokopedia/10 text-tokopedia"
      }`}
    >
      margin {markup}%{tipis ? " · tipis" : ""}
    </span>
  );
}

function SyncDashboard() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: SYNC_KEY });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: SYNC_KEY,
    queryFn: () => listProductSync(),
  });

  const syncMut = useMutation({
    mutationFn: (rowId: string) => syncProductNow({ data: { id: rowId } }),
    onSuccess: (res) => {
      refresh();
      if (res?.event) toast.info(res.event.detail);
      else toast.success("Tersinkron — tidak ada perubahan");
    },
    onError: (e: Error) => toast.error(`Gagal sinkron: ${e.message}`),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "active" | "draft" }) =>
      adminSetStatus({ data: { ids: [v.id], status: v.status } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(`Gagal ubah status: ${e.message}`),
  });

  const batchMut = useMutation({
    mutationFn: () => runSyncBatch({ data: {} }),
    onSuccess: (res) => {
      refresh();
      toast.success(`Batch selesai: ${res.checked} dicek, ${res.changes} perubahan`);
    },
    onError: (e: Error) => toast.error(`Gagal jalankan batch: ${e.message}`),
  });

  const stats = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.sync_status === s).length;
    return {
      total: rows.length,
      ok: by("ok"),
      oos: by("out_of_stock"),
      error: by("error"),
      idle: by("idle"),
    };
  }, [rows]);

  const tiles = [
    { label: "Total ber-link", value: stats.total, icon: PackageCheck, tone: "text-foreground" },
    {
      label: "Stok habis (disembunyikan)",
      value: stats.oos,
      icon: CircleSlash,
      tone: "text-destructive",
    },
    {
      label: "Gagal sinkron",
      value: stats.error,
      icon: AlertTriangle,
      tone: "text-[var(--chart-4)]",
    },
    { label: "Belum pernah dicek", value: stats.idle, icon: Clock, tone: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Sinkronisasi Produk
          </h1>
          <p className="text-sm text-muted-foreground">
            Stok &amp; harga produk marketplace. Yang butuh perhatian tampil di atas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => batchMut.mutate()}
          disabled={batchMut.isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${batchMut.isPending ? "animate-spin" : ""}`} />
          {batchMut.isPending ? "Menyinkron…" : "Sinkron batch sekarang"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
              <t.icon className={`h-4 w-4 ${t.tone}`} />
            </div>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${t.tone}`}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Produk</th>
                <th className="px-3 py-2.5 font-medium">Sumber</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Modal / Jual</th>
                <th className="px-3 py-2.5 font-medium">Terakhir dicek</th>
                <th className="px-3 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <SyncRowView
                  key={r.id}
                  row={r}
                  syncing={syncMut.isPending && syncMut.variables === r.id}
                  onSync={() => syncMut.mutate(r.id)}
                  onToggleHide={() =>
                    statusMut.mutate({
                      id: r.id,
                      status: r.admin_status === "active" ? "draft" : "active",
                    })
                  }
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {isLoading
                      ? "Memuat…"
                      : isError
                        ? "Gagal memuat. Coba muat ulang."
                        : "Belum ada produk ber-link marketplace. Tambahkan link Shopee/Tokopedia/TikTok di editor produk."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SyncRowView({
  row,
  syncing,
  onSync,
  onToggleHide,
}: {
  row: ProductSyncRow;
  syncing: boolean;
  onSync: () => void;
  onToggleHide: () => void;
}) {
  const meta = STATUS_META[row.sync_status] ?? STATUS_META.idle;
  const hidden = row.admin_status !== "active";
  return (
    <tr className="transition-colors hover:bg-muted/50">
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {row.image ? (
            <img
              src={row.image}
              alt={row.title}
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-muted" />
          )}
          <div className="min-w-0 max-w-[16rem]">
            <p className="truncate font-medium text-foreground">{row.title}</p>
            {row.last_error && (
              <p className="truncate text-xs text-[var(--chart-4)]" title={row.last_error}>
                {row.last_error}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        {row.marketplace ? (
          <span className="capitalize text-muted-foreground">{row.marketplace}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
            {meta.label}
          </span>
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {tierLabel(row.admin_status, row.sync_status)}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="space-y-0.5 text-xs">
          <div className="text-muted-foreground">
            Modal:{" "}
            <span className="font-medium text-foreground">
              {row.source_price != null ? formatRupiah(row.source_price) : "—"}
            </span>
          </div>
          <div className="text-muted-foreground">
            Jual:{" "}
            <span className="font-medium text-foreground">
              {(row.sale_price ?? row.price) != null
                ? formatRupiah((row.sale_price ?? row.price)!)
                : "—"}
            </span>
          </div>
          {marginBadge(row.source_price, row.sale_price ?? row.price)}
        </div>
      </td>
      <td className="px-3 py-3 text-muted-foreground">{lastChecked(row.last_checked_at)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            aria-label={`Sinkron ${row.title}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onToggleHide}
            aria-label={hidden ? `Tampilkan ${row.title}` : `Sembunyikan ${row.title}`}
            title={hidden ? "Tampilkan di etalase" : "Sembunyikan dari etalase"}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <Link
            to="/admin/products/$id"
            params={{ id: row.id }}
            aria-label={`Edit ${row.title}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}
