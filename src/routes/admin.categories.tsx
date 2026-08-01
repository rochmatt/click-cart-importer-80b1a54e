import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderTree, Package, Loader2, Pencil } from "lucide-react";
import {
  CATEGORIES,
  categoryKey,
  formatRupiah,
  useAdminProductsQuery,
  type AdminProduct,
} from "@/lib/admin-store";
import { GROUP_NAMES, useCategoryOverrides } from "@/lib/category-overrides";
import {
  CategoryEditDialog,
  type CategoryEditTarget,
} from "@/components/admin/CategoryEditDialog";


export const Route = createFileRoute("/admin/categories")({
  head: () => ({
    meta: [
      { title: "Categories — PasarPilih Admin" },
      { name: "description", content: "Organise the PasarPilih catalog into categories and subcategories." },
      { property: "og:title", content: "Categories — PasarPilih Admin" },
      { property: "og:description", content: "Manage catalog categories for the PasarPilih storefront." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CategoriesPage,
});

type Stats = { total: number; active: number; stock: number; value: number };

function statsFor(items: AdminProduct[]): Stats {
  return items.reduce<Stats>(
    (acc, p) => ({
      total: acc.total + 1,
      active: acc.active + (p.status === "active" ? 1 : 0),
      stock: acc.stock + p.stock,
      value: acc.value + (p.salePrice ?? p.price) * p.stock,
    }),
    { total: 0, active: 0, stock: 0, value: 0 },
  );
}

function CategoriesPage() {
  const { data, isLoading, error } = useAdminProductsQuery();
  const { groupOf } = useCategoryOverrides();
  const [target, setTarget] = useState<CategoryEditTarget | null>(null);
  const products = data ?? [];

  // Dedupe case- and whitespace-insensitively so "PC" and " pc " are one entry.
  const byKey = new Map<string, string>();
  for (const n of [...CATEGORIES, ...products.map((p) => p.category).filter(Boolean)]) {
    if (!byKey.has(categoryKey(n))) byKey.set(categoryKey(n), n);
  }
  const allNames = Array.from(byKey.values());
  const grouped = GROUP_NAMES.map((g) => ({
    group: g,
    items: allNames.filter((n) => groupOf(n) === g),
  }));
  const unmapped = allNames.filter((n) => !groupOf(n));

  const openEditor = (name: string, group: string) => {
    const s = statsFor(
      products.filter((p) => categoryKey(p.category) === categoryKey(name)),
    );
    setTarget({ name, group, total: s.total, active: s.active });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Group products into browsable collections and review catalog coverage.
          </p>
        </div>
        <Link
          to="/admin/products"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
        >
          <Package className="h-4 w-4" />
          Manage products
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading categories…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          Could not load products for category stats.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => {
            const keys = new Set(group.items.map(categoryKey));
            const gs = statsFor(products.filter((p) => keys.has(categoryKey(p.category))));
            return (
              <section
                key={group.group}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
                      <FolderTree className="h-4 w-4" />
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">{group.group}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {gs.total} products · {gs.active} active · stock value {formatRupiah(gs.value)}
                  </p>
                </header>

                <div className="divide-y divide-border">
                  {group.items.length === 0 && (
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      No categories mapped to this group yet.
                    </p>
                  )}
                  {group.items.map((name) => {
                    const s = statsFor(
                      products.filter((p) => categoryKey(p.category) === categoryKey(name)),
                    );
                    return (
                      <div
                        key={name}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.total} products · {s.stock} in stock
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                            {s.active} active
                          </span>
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {s.total - s.active} draft
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditor(name, group.group)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {unmapped.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Unmapped categories</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                These products use a category outside the current groups.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {unmapped.map((c) => (
                  <li key={c} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {c || "(empty)"} —{" "}
                      {products.filter((p) => categoryKey(p.category) === categoryKey(c)).length}{" "}
                      products
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditor(c, GROUP_NAMES[0])}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <CategoryEditDialog
        target={target}
        existingNames={allNames}
        onOpenChange={(open) => !open && setTarget(null)}
      />

    </div>
  );

}
