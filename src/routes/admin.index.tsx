import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useAdminProductsQuery, formatRupiah } from "@/lib/admin-store";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — PasarPilih Console" },
      {
        name: "description",
        content:
          "Overview of sales, orders, catalog health and recent product activity in the PasarPilih admin console.",
      },
      { property: "og:title", content: "Admin Dashboard — PasarPilih Console" },
      {
        property: "og:description",
        content: "Sales, orders and catalog overview for PasarPilih store admins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const STATS = [
  { label: "Revenue (30d)", value: "Rp 486.250.000", delta: "+12.4%", up: true, icon: DollarSign },
  { label: "Orders (30d)", value: "1.284", delta: "+8.1%", up: true, icon: ShoppingCart },
  { label: "New customers", value: "342", delta: "-3.2%", up: false, icon: Users },
  { label: "Outbound clicks", value: "18.940", delta: "+21.7%", up: true, icon: ArrowUpRight },
];

function AdminDashboard() {
  const { data: products = [] } = useAdminProductsQuery();
  const active = products.filter((p) => p.status === "active").length;
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const recent = [...products]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Here's how the storefront performed over the last 30 days.
          </p>
        </div>
        <Link
          to="/admin/products/$id"
          params={{ id: "new" }}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
        >
          Add product
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{s.value}</p>
            <p
              className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
                s.up ? "text-tokopedia" : "text-destructive"
              }`}
            >
              {s.up ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {s.delta} vs last period
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Recently updated products</h2>
            <Link to="/admin/products" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                <img
                  src={p.images[0]}
                  alt={p.title}
                  loading="lazy"
                  className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                <p className="hidden text-sm font-medium text-foreground sm:block">
                  {formatRupiah(p.salePrice ?? p.price)}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                    p.status === "active"
                      ? "bg-tokopedia/10 text-tokopedia"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Catalog health</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Total products</dt>
                <dd className="font-medium text-foreground">{products.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Active</dt>
                <dd className="font-medium text-foreground">{active}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Drafts</dt>
                <dd className="font-medium text-foreground">{products.length - active}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Out of stock</dt>
                <dd className="font-medium text-destructive">{outOfStock}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package className="h-4 w-4 text-muted-foreground" /> Quick actions
            </h2>
            <div className="mt-3 grid gap-2">
              <Link
                to="/admin/products/$id"
                params={{ id: "new" }}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Add a new product
              </Link>
              <Link
                to="/admin/products"
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Review drafts
              </Link>
              <Link
                to="/admin/orders"
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Check open orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
