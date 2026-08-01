import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useAdminProductsQuery,
  useDeleteProducts,
  useRestoreProducts,
  useSetStatus,
  type AdminProduct,

  formatRupiah,
  CATEGORIES,
  type ProductStatus,
} from "@/lib/admin-store";

export const Route = createFileRoute("/admin/products/")({
  head: () => ({
    meta: [
      { title: "Products — PasarPilih Admin" },
      {
        name: "description",
        content:
          "Search, filter and bulk-manage every product in the PasarPilih catalog, including marketplace redirect links.",
      },
      { property: "og:title", content: "Products — PasarPilih Admin" },
      {
        property: "og:description",
        content: "Manage the PasarPilih product catalog: pricing, stock, status and marketplace links.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProductsList,
});

const PER_PAGE = 6;

function ProductsList() {
  const { data: products = [], isLoading, isError } = useAdminProductsQuery();
  const deleteMutation = useDeleteProducts();
  const restoreMutation = useRestoreProducts();
  const [pendingDelete, setPendingDelete] = useState<AdminProduct[]>([]);
  const statusMutation = useSetStatus();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q)) &&
        (category === "all" || p.category === category) &&
        (status === "all" || p.status === status),
    );
  }, [products, query, category, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const busy = deleteMutation.isPending || statusMutation.isPending;

  function toggleAll() {
    setSelected(allChecked ? [] : rows.map((r) => r.id));
  }

  function toggleOne(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function bulkStatus(next: ProductStatus) {
    const count = selected.length;
    statusMutation.mutate(
      { ids: selected, status: next },
      {
        onSuccess: () => {
          toast.success(`${count} product(s) marked ${next}`);
          setSelected([]);
        },
        onError: (e: Error) => toast.error(`Could not update products: ${e.message}`),
      },
    );
  }

  function removeProducts(items: AdminProduct[]) {
    const ids = items.map((p) => p.id);
    const label =
      items.length === 1 ? `"${items[0].title}"` : `${items.length} products`;
    deleteMutation.mutate(ids, {
      onSuccess: () => {
        setSelected((sel) => sel.filter((id) => !ids.includes(id)));
        const toastId = `delete-${ids.join("-")}`;
        let undoUsed = false;
        toast.success(`Deleted ${label}`, {
          id: toastId,
          description: "You have 8 seconds to undo this delete.",
          duration: 8000,
          action: {
            label: "Undo",
            onClick: () => {
              if (undoUsed || restoreMutation.isPending) return;
              undoUsed = true;
              toast.dismiss(toastId);
              toast.loading(`Restoring ${label}…`, { id: toastId });
              restoreMutation.mutate(items, {
                onSuccess: () =>
                  toast.success(`Restored ${label}`, { id: toastId, duration: 4000 }),
                onError: (e: Error) => {
                  undoUsed = false;
                  toast.error(`Could not restore: ${e.message}`, {
                    id: toastId,
                    duration: 6000,
                  });
                },
              });
            },
          },
          onAutoClose: () => {
            if (undoUsed) return;
            toast.info(`Undo window expired for ${label}`, {
              description: "This delete is now permanent and can't be undone.",
              duration: 6000,
            });
          },
        });
      },
      onError: (e: Error) => toast.error(`Could not delete: ${e.message}`),
    });
  }


  function confirmDelete() {
    const items = pendingDelete;
    setPendingDelete([]);
    if (items.length) removeProducts(items);
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {products.length} products shown
          </p>
        </div>
        <Link
          to="/admin/products/$id"
          params={{ id: "new" }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Add product
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search products…"
              aria-label="Search products"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Filter className="h-3.5 w-3.5" /> Filter
          </span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/40 px-3 py-2 text-sm">
            <span className="font-medium text-foreground">{selected.length} selected</span>
            <button
              type="button"
              onClick={() => bulkStatus("active")}
              className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
            >
              Set active
            </button>
            <button
              type="button"
              onClick={() => bulkStatus("draft")}
              className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
            >
              Set draft
            </button>
            <button
              type="button"
              onClick={() =>
                setPendingDelete(products.filter((p) => selected.includes(p.id)))
              }
              className="rounded-lg border border-destructive/30 bg-card px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Delete
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">Product</th>
                <th className="px-3 py-2.5 font-medium">Category</th>
                <th className="px-3 py-2.5 font-medium">Price</th>
                <th className="px-3 py-2.5 font-medium">Stock / Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={() => toggleOne(p.id)}
                      aria-label={`Select ${p.title}`}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.images[0]}
                        alt={p.title}
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
                      />
                      <div className="min-w-0 max-w-[18rem]">
                        <p className="truncate font-medium text-foreground">{p.title}</p>
                        <p className="text-xs text-muted-foreground">SKU-{p.id.toUpperCase()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{p.category}</td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-foreground">
                      {formatRupiah(p.salePrice ?? p.price)}
                    </span>
                    {p.salePrice !== null && (
                      <span className="ml-1 text-xs text-muted-foreground line-through">
                        {formatRupiah(p.price)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                          p.status === "active"
                            ? "bg-tokopedia/10 text-tokopedia"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {p.status}
                      </span>
                      <span
                        className={`text-xs ${p.stock === 0 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to="/admin/products/$id"
                        params={{ id: p.id }}
                        aria-label={`Edit ${p.title}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${p.title}`}
                        onClick={() => setPendingDelete([p])}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {isLoading
                      ? "Loading products…"
                      : isError
                        ? "Could not load products. Please refresh."
                        : "No products match your filters."}
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-sm">
          <p className="text-xs text-muted-foreground">
            Page {current} of {pageCount}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === current ? "page" : undefined}
                className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                  n === current
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={current === pageCount}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingDelete.length > 0}
        onOpenChange={(open) => {
          if (!open) setPendingDelete([]);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete.length === 1
                ? `Delete "${pendingDelete[0].title}"?`
                : `Delete ${pendingDelete.length} products?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete.length === 1
                ? "This product will be removed from the storefront catalog."
                : "These products will be removed from the storefront catalog."}{" "}
              You can undo this from the notification right after deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
