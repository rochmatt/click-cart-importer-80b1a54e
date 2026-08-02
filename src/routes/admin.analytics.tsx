import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Eye, MousePointerClick, ShoppingBag, TrendingUp } from "lucide-react";
import {
  MARKETPLACES,
  formatCompactIDR,
  formatIDR,
  summarize,
  useSalesAnalytics,
  type DrillSelection,
  type RangeDays,
} from "@/lib/sales-analytics";
import { AnalyticsDrilldown } from "@/components/admin/AnalyticsDrilldown";

const analyticsSearchSchema = z.object({
  days: fallback(z.number(), 30).default(30),
  drill: fallback(z.string(), "").default(""),
  date: fallback(z.string(), "").default(""),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  channel: fallback(z.string(), "").default(""),
});

type AnalyticsSearch = z.infer<typeof analyticsSearchSchema>;

function searchToSelection(s: AnalyticsSearch): DrillSelection | null {
  if (s.drill === "date" && s.date) return { type: "date", value: s.date };
  if (s.drill === "range" && s.from && s.to) return { type: "range", from: s.from, to: s.to };
  if (s.drill === "channel" && s.channel) return { type: "channel", value: s.channel };
  return null;
}

function selectionToSearch(sel: DrillSelection | null) {
  if (!sel) return { drill: "", date: "", from: "", to: "", channel: "" };
  if (sel.type === "date")
    return { drill: "date", date: sel.value, from: "", to: "", channel: "" };
  if (sel.type === "range")
    return { drill: "range", date: "", from: sel.from, to: sel.to, channel: "" };
  return { drill: "channel", date: "", from: "", to: "", channel: sel.value };
}

export const Route = createFileRoute("/admin/analytics")({
  validateSearch: zodValidator(analyticsSearchSchema),
  search: {
    middlewares: [
      stripSearchParams({ days: 30, drill: "", date: "", from: "", to: "", channel: "" }),
    ],
  },
  head: () => ({
    meta: [
      { title: "Sales Analytics — PasarPilih Admin" },
      {
        name: "description",
        content:
          "Track revenue by marketplace channel, top performing products and conversion rates across Shopee, Tokopedia and TikTok Shop.",
      },
      { property: "og:title", content: "Sales Analytics — PasarPilih Admin" },
      {
        property: "og:description",
        content: "Revenue by channel, top products and conversion rates for the PasarPilih storefront.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

const RANGES: { value: RangeDays; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className}`}>
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Eye;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function AnalyticsPage() {
  const search = Route.useSearch() as AnalyticsSearch;
  const navigate = useNavigate({ from: Route.fullPath });

  const days = ([7, 14, 30] as const).includes(search.days as RangeDays)
    ? (search.days as RangeDays)
    : 30;
  const drill = searchToSelection(search);

  const setDays = (value: RangeDays) =>
    navigate({ search: (prev: AnalyticsSearch) => ({ ...prev, days: value }), replace: true });
  const setDrill = (sel: DrillSelection | null) =>
    navigate({ search: (prev: AnalyticsSearch) => ({ ...prev, ...selectionToSearch(sel) }), replace: true });

  const { data, isPending, isError, error } = useSalesAnalytics(days);

  const stats = summarize(data ?? []);
  const { totals, channels, topProducts, trend } = stats;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Sales analytics</h1>
          <p className="text-sm text-muted-foreground">
            Marketplace performance across Shopee, Tokopedia and TikTok Shop.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setDays(r.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                days === r.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load analytics: {(error as Error).message}
        </div>
      )}

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Revenue"
              value={formatIDR(totals.revenue)}
              hint={`Last ${days} days, all channels`}
              icon={TrendingUp}
            />
            <Kpi
              label="Orders"
              value={totals.orders.toLocaleString()}
              hint={`AOV ${formatCompactIDR(Math.round(totals.aov))}`}
              icon={ShoppingBag}
            />
            <Kpi
              label="Conversion rate"
              value={`${totals.conversion.toFixed(2)}%`}
              hint="Orders per marketplace click"
              icon={MousePointerClick}
            />
            <Kpi
              label="Click-through rate"
              value={`${totals.ctr.toFixed(2)}%`}
              hint={`${totals.views.toLocaleString()} product views`}
              icon={Eye}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              title="Revenue trend"
              subtitle="Daily revenue across all marketplaces — click a day to drill down"
              className="xl:col-span-2"
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trend}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    style={{ cursor: "pointer" }}
                    onClick={(state: { activeLabel?: string | number }) => {
                      const label = state?.activeLabel;
                      if (typeof label === "string") setDrill({ type: "date", value: label });
                    }}
                  >
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatCompactIDR(v)}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatIDR(v), "Revenue"]}
                      labelFormatter={(l: string) => shortDate(l)}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#revFill)"
                      activeDot={{ r: 5, cursor: "pointer" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Revenue by channel" subtitle="Share of total revenue — click a slice to drill down">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channels}
                      dataKey="revenue"
                      nameKey="label"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      stroke="none"
                      cursor="pointer"
                      onClick={(entry: { id?: string }) => {
                        if (entry?.id) setDrill({ type: "channel", value: entry.id });
                      }}
                    >
                      {channels.map((c) => (
                        <Cell key={c.id} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, n: string) => [formatIDR(v), n]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-2">
                {channels.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setDrill({ type: "channel", value: c.id })}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-accent"
                    >
                    <span className="flex items-center gap-2 text-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.label}
                    </span>
                    <span className="text-muted-foreground">
                      {formatCompactIDR(c.revenue)} · {c.share.toFixed(1)}%
                    </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              title="Conversion by channel"
              subtitle="Orders per outbound click — click a bar to drill down"
              className="xl:col-span-1"
            >
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channels} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => `${v}%`}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(2)}%`, "Conversion"]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="conversion"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(entry: { id?: string }) => {
                        if (entry?.id) setDrill({ type: "channel", value: entry.id });
                      }}
                    >
                      {channels.map((c) => (
                        <Cell key={c.id} fill={c.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card
              title="Channel performance"
              subtitle="Views, clicks, orders and value per marketplace"
              className="xl:col-span-2"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Channel</th>
                      <th className="py-2 pr-3 text-right font-medium">Views</th>
                      <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                      <th className="py-2 pr-3 text-right font-medium">CTR</th>
                      <th className="py-2 pr-3 text-right font-medium">Orders</th>
                      <th className="py-2 pr-3 text-right font-medium">Conv.</th>
                      <th className="py-2 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setDrill({ type: "channel", value: c.id })}
                        className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/50"
                      >
                        <td className="py-2.5 pr-3">
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: c.color }}
                            />
                            {c.label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                          {c.views.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                          {c.clicks.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                          {c.ctr.toFixed(1)}%
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                          {c.orders.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-foreground">
                          {c.conversion.toFixed(2)}%
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-foreground">
                          {formatCompactIDR(c.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card title="Top products" subtitle={`Best sellers over the last ${days} days`}>
            <ul className="space-y-3">
              {topProducts.slice(0, 8).map((p, i) => (
                <li key={p.ref} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCompactIDR(p.revenue)}
                      </p>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${topProducts[0]?.revenue ? (p.revenue / topProducts[0].revenue) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {p.orders.toLocaleString()} orders · {p.clicks.toLocaleString()} clicks ·{" "}
                      {p.conversion.toFixed(2)}% conversion · {p.share.toFixed(1)}% of revenue
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <AnalyticsDrilldown
        rows={data ?? []}
        selection={drill}
        onOpenChange={(open) => !open && setDrill(null)}
        onSelectionChange={setDrill}
      />
    </div>
  );
}
