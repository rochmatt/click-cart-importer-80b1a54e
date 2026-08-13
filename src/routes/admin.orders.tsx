import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, Loader2, RefreshCw, Search, ShoppingCart, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type AdminOrder,
  checkOrderSupplier,
  listAdminOrders,
  updateAdminOrder,
} from "@/lib/admin.functions";

const STATUSES = [
  "processing",
  "packed",
  "shipped",
  "in transit",
  "delivered",
  "cancelled",
] as const;

const statusTone: Record<string, string> = {
  delivered: "bg-chart-2/15 text-chart-2",
  shipped: "bg-primary/10 text-primary",
  "in transit": "bg-primary/10 text-primary",
  packed: "bg-chart-4/15 text-chart-4",
  processing: "bg-chart-4/15 text-chart-4",
  cancelled: "bg-destructive/10 text-destructive",
};

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — PasarPilih Admin" },
      { name: "description", content: "Track order status, couriers and fulfilment across the PasarPilih store." },
      { property: "og:title", content: "Orders — PasarPilih Admin" },
      { property: "og:description", content: "Order tracking and fulfilment for PasarPilih store admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOrdersPage,
});

const currency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(listAdminOrders);
  const save = useServerFn(updateAdminOrder);

  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<AdminOrder | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => fetchOrders(),
  });

  const saveMutation = useMutation({
    mutationFn: (input: {
      id: string;
      status: (typeof STATUSES)[number];
      courier: string;
      tracking_number: string;
      eta_date: string;
      last_update: string;
    }) => save({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      setEditing(null);
      toast.success("Order updated");
    },
    onError: () => toast.error("Could not update the order"),
  });

  const orders = ordersQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        o.product_name.toLowerCase().includes(q) ||
        (o.tracking_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, term, statusFilter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [orders]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-foreground">
          <ShoppingCart className="h-5 w-5 text-primary" />
          Orders
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow every order from payment to delivery and update fulfilment details.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search order number, email or product"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...STATUSES] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                statusFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {value}
              {value !== "all" && counts[value] ? ` (${counts[value]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {ordersQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
        </p>
      ) : ordersQuery.isError ? (
        <p className="text-sm text-destructive">Could not load orders.</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No orders match this view yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Order</th>
                  <th className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Shipment</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("id-ID")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{order.shipping_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{order.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qty {order.quantity}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {currency(order.total ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                          statusTone[order.status] ?? "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <p>{order.courier || "No courier"}</p>
                      <p>{order.tracking_number || "No tracking number"}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(order)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <form
          className="rounded-2xl border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({
              id: editing.id,
              status: editing.status as (typeof STATUSES)[number],
              courier: editing.courier ?? "",
              tracking_number: editing.tracking_number ?? "",
              eta_date: editing.eta_date ?? "",
              last_update: editing.last_update ?? "",
            });
          }}
        >
          <h2 className="text-sm font-bold text-foreground">
            Update {editing.order_number}
          </h2>

          <SupplierCheckPanel key={editing.id} orderId={editing.id} />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order-status">Status</Label>
              <select
                id="order-status"
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-courier">Courier</Label>
              <Input
                id="order-courier"
                value={editing.courier ?? ""}
                onChange={(e) => setEditing({ ...editing, courier: e.target.value })}
                placeholder="JNE / SiCepat"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-tracking">Tracking number</Label>
              <Input
                id="order-tracking"
                value={editing.tracking_number ?? ""}
                onChange={(e) => setEditing({ ...editing, tracking_number: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-eta">ETA</Label>
              <Input
                id="order-eta"
                type="date"
                value={editing.eta_date ?? ""}
                onChange={(e) => setEditing({ ...editing, eta_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="order-note">Latest update note</Label>
              <Input
                id="order-note"
                value={editing.last_update ?? ""}
                onChange={(e) => setEditing({ ...editing, last_update: e.target.value })}
                placeholder="Package handed to courier"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const VERDICT_META: Record<string, { label: string; cls: string }> = {
  ok: { label: "Aman", cls: "bg-chart-2/15 text-chart-2" },
  margin_loss: { label: "Rugi", cls: "bg-destructive/10 text-destructive" },
  out_of_stock: { label: "Stok habis", cls: "bg-destructive/10 text-destructive" },
  untracked: { label: "Tak terlacak", cls: "bg-secondary text-muted-foreground" },
  error: { label: "Gagal baca", cls: "bg-chart-4/15 text-chart-4" },
};

/**
 * Konfirmasi manual sebelum fulfill (dropship): baca ulang stok & harga modal
 * supplier sekarang, lalu bandingkan dengan yang DIBAYAR pelanggan. Di-remount
 * per pesanan (key={editing.id}) supaya hasilnya bersih tiap ganti order.
 */
function SupplierCheckPanel({ orderId }: { orderId: string }) {
  const check = useServerFn(checkOrderSupplier);
  const mutation = useMutation({
    mutationFn: () => check({ data: { id: orderId } }),
    onError: () => toast.error("Gagal cek supplier"),
  });
  const res = mutation.data;

  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Store className="h-4 w-4 text-primary" /> Konfirmasi supplier sebelum fulfill
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Baca ulang stok &amp; harga modal langsung dari marketplace, lalu bandingkan dengan
            yang dibayar pelanggan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {mutation.isPending ? "Mengecek…" : "Cek supplier sekarang"}
        </button>
      </div>

      {mutation.isError && (
        <p className="mt-3 text-xs text-destructive">Gagal mengecek supplier. Coba lagi.</p>
      )}

      {res && (
        <div className="mt-3 space-y-2">
          {res.summary.blocked > 0 ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              ⚠️ {res.summary.blocked} item bermasalah — sebaiknya JANGAN fulfill dulu.
            </p>
          ) : res.summary.warn > 0 ? (
            <p className="rounded-lg bg-chart-4/15 px-3 py-2 text-xs font-semibold text-chart-4">
              {res.summary.warn} item tak bisa dipastikan otomatis — cek manual.
            </p>
          ) : res.items.length > 0 ? (
            <p className="rounded-lg bg-chart-2/15 px-3 py-2 text-xs font-semibold text-chart-2">
              ✓ Semua item aman untuk difulfill.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Pesanan ini tak punya item.</p>
          )}

          {res.items.map((it, idx) => {
            const meta = VERDICT_META[it.verdict] ?? VERDICT_META.untracked;
            return (
              <div key={idx} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{it.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Qty {it.quantity} · dibayar {currency(it.orderedUnitPrice)}
                      {it.cost != null ? ` · modal kini ${currency(it.cost)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-foreground/80">{it.note}</p>
                {it.sourceUrl && (
                  <a
                    href={it.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Buka di {it.marketplace ?? "marketplace"}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
