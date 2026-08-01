import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listAdminCustomers } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — PasarPilih Admin" },
      { name: "description", content: "Review customer profiles, order history and lifetime value on PasarPilih." },
      { property: "og:title", content: "Customers — PasarPilih Admin" },
      { property: "og:description", content: "Customer profiles and purchase history for PasarPilih admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCustomersPage,
});

const currency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

function AdminCustomersPage() {
  const fetchCustomers = useServerFn(listAdminCustomers);
  const [term, setTerm] = useState("");
  const [segment, setSegment] = useState<"all" | "repeat" | "new" | "lapsed">("all");

  const customersQuery = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => fetchCustomers(),
  });

  const customers = customersQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return customers.filter((c) => {
      if (q && !`${c.display_name} ${c.email} ${c.phone}`.toLowerCase().includes(q)) return false;
      if (segment === "repeat") return c.order_count > 1;
      if (segment === "new") return c.order_count === 0;
      if (segment === "lapsed")
        return c.order_count > 0 && (!c.last_order_at || new Date(c.last_order_at).getTime() < ninetyDaysAgo);
      return true;
    });
  }, [customers, term, segment]);

  const totals = useMemo(
    () => ({
      customers: customers.length,
      buyers: customers.filter((c) => c.order_count > 0).length,
      revenue: customers.reduce((sum, c) => sum + c.lifetime_value, 0),
    }),
    [customers],
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-foreground">
          <Users className="h-5 w-5 text-primary" />
          Customers
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Understand who is buying, how often, and how much they spend.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Registered customers" value={String(totals.customers)} />
        <Stat label="Customers with orders" value={String(totals.buyers)} />
        <Stat label="Lifetime revenue" value={currency(totals.revenue)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name, email or phone"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "repeat", "new", "lapsed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSegment(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                segment === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "new" ? "no orders" : value}
            </button>
          ))}
        </div>
      </div>

      {customersQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
        </p>
      ) : customersQuery.isError ? (
        <p className="text-sm text-destructive">Could not load customers.</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No customers match this view yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone</th>
                  <th className="px-4 py-3 text-right font-semibold">Orders</th>
                  <th className="px-4 py-3 text-right font-semibold">Lifetime value</th>
                  <th className="px-4 py-3 text-left font-semibold">Last order</th>
                  <th className="px-4 py-3 text-left font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-2 font-semibold text-foreground">
                        {customer.display_name || "Unnamed shopper"}
                        {customer.is_admin && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{customer.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{customer.phone || "—"}</td>
                    <td className="px-4 py-3 text-right text-foreground">{customer.order_count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {currency(customer.lifetime_value)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {customer.last_order_at
                        ? new Date(customer.last_order_at).toLocaleDateString("id-ID")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(customer.created_at).toLocaleDateString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-foreground">{value}</p>
    </div>
  );
}
