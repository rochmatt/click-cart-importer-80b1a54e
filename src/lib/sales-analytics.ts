import { useQuery } from "@tanstack/react-query";
import { fetchSalesEvents } from "@/lib/content.functions";
import { products as catalog } from "@/data/products";

export type SalesRow = {
  event_date: string;
  marketplace: string;
  product_ref: string;
  views: number;
  clicks: number;
  orders: number;
  revenue: number;
};

export type RangeDays = 7 | 14 | 30;

export const MARKETPLACES = [
  { id: "shopee", label: "Shopee", color: "var(--chart-1)" },
  { id: "tokopedia", label: "Tokopedia", color: "var(--chart-2)" },
  { id: "tiktok", label: "TikTok Shop", color: "var(--chart-3)" },
] as const;

const titleByRef = new Map(catalog.map((p) => [p.id, p.title]));

/** Analytics rows reference catalog products as "p1", "p2", ... */
export function productTitle(ref: string) {
  return titleByRef.get(ref) ?? titleByRef.get(ref.replace(/^p/, "")) ?? ref;
}

export function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactIDR(value: number) {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `Rp${Math.round(value / 1_000)}rb`;
  return `Rp${value}`;
}

export function percent(part: number, whole: number) {
  if (!whole) return 0;
  return (part / whole) * 100;
}

async function fetchSales(days: RangeDays): Promise<SalesRow[]> {
  // Perhitungan tanggal pindah ke server bersama query-nya.
  return (await fetchSalesEvents({ data: days })) as unknown as SalesRow[];
}

export function useSalesAnalytics(days: RangeDays) {
  return useQuery({
    queryKey: ["sales-analytics", days],
    queryFn: () => fetchSales(days),
    staleTime: 60_000,
  });
}

type Totals = { views: number; clicks: number; orders: number; revenue: number };

const emptyTotals = (): Totals => ({ views: 0, clicks: 0, orders: 0, revenue: 0 });

function add(target: Totals, row: SalesRow) {
  target.views += row.views;
  target.clicks += row.clicks;
  target.orders += row.orders;
  target.revenue += row.revenue;
}

export function summarize(rows: SalesRow[]) {
  const totals = emptyTotals();
  const byChannel = new Map<string, Totals>();
  const byProduct = new Map<string, Totals>();
  const byDate = new Map<string, Totals & { date: string }>();

  for (const row of rows) {
    add(totals, row);

    if (!byChannel.has(row.marketplace)) byChannel.set(row.marketplace, emptyTotals());
    add(byChannel.get(row.marketplace)!, row);

    if (!byProduct.has(row.product_ref)) byProduct.set(row.product_ref, emptyTotals());
    add(byProduct.get(row.product_ref)!, row);

    if (!byDate.has(row.event_date))
      byDate.set(row.event_date, { date: row.event_date, ...emptyTotals() });
    add(byDate.get(row.event_date)!, row);
  }

  const channels = MARKETPLACES.map((m) => {
    const t = byChannel.get(m.id) ?? emptyTotals();
    return {
      ...m,
      ...t,
      share: percent(t.revenue, totals.revenue),
      ctr: percent(t.clicks, t.views),
      conversion: percent(t.orders, t.clicks),
      aov: t.orders ? t.revenue / t.orders : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const topProducts = [...byProduct.entries()]
    .map(([ref, t]) => ({
      ref,
      title: productTitle(ref),
      ...t,
      conversion: percent(t.orders, t.clicks),
      share: percent(t.revenue, totals.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const trend = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    totals: {
      ...totals,
      ctr: percent(totals.clicks, totals.views),
      conversion: percent(totals.orders, totals.clicks),
      aov: totals.orders ? totals.revenue / totals.orders : 0,
    },
    channels,
    topProducts,
    trend,
  };
}

export type DrillSelection =
  | { type: "date"; value: string }
  | { type: "range"; from: string; to: string }
  | { type: "channel"; value: string };

export function channelLabel(id: string) {
  return MARKETPLACES.find((m) => m.id === id)?.label ?? id;
}

export function channelColor(id: string) {
  return MARKETPLACES.find((m) => m.id === id)?.color ?? "var(--chart-1)";
}

/** Slice the raw event rows for a day, a date range, or a single marketplace. */
export function drillDown(rows: SalesRow[], sel: DrillSelection) {
  const scoped = rows.filter((r) => {
    if (sel.type === "date") return r.event_date === sel.value;
    if (sel.type === "range") return r.event_date >= sel.from && r.event_date <= sel.to;
    return r.marketplace === sel.value;
  });

  const totals = emptyTotals();
  const bySegment = new Map<string, Totals>();
  const byProduct = new Map<string, Totals & { channels: Map<string, Totals> }>();

  for (const row of scoped) {
    add(totals, row);

    const segKey = sel.type === "date" ? row.marketplace : row.event_date;

    if (!bySegment.has(segKey)) bySegment.set(segKey, emptyTotals());
    add(bySegment.get(segKey)!, row);

    if (!byProduct.has(row.product_ref))
      byProduct.set(row.product_ref, { ...emptyTotals(), channels: new Map() });
    const prod = byProduct.get(row.product_ref)!;
    add(prod, row);
    if (!prod.channels.has(row.marketplace)) prod.channels.set(row.marketplace, emptyTotals());
    add(prod.channels.get(row.marketplace)!, row);
  }

  const segments = [...bySegment.entries()]
    .map(([key, t]) => ({
      key,
      label: sel.type === "date" ? channelLabel(key) : key,
      color: sel.type === "date" ? channelColor(key) : "var(--chart-1)",
      ...t,
      ctr: percent(t.clicks, t.views),
      conversion: percent(t.orders, t.clicks),
      share: percent(t.revenue, totals.revenue),
    }))
    .sort((a, b) => (sel.type === "date" ? b.revenue - a.revenue : a.key.localeCompare(b.key)));

  const items = [...byProduct.entries()]
    .map(([ref, t]) => ({
      ref,
      title: productTitle(ref),
      views: t.views,
      clicks: t.clicks,
      orders: t.orders,
      revenue: t.revenue,
      conversion: percent(t.orders, t.clicks),
      share: percent(t.revenue, totals.revenue),
      topChannel:
        [...t.channels.entries()].sort((a, b) => b[1].revenue - a[1].revenue)[0]?.[0] ?? "",
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totals: {
      ...totals,
      ctr: percent(totals.clicks, totals.views),
      conversion: percent(totals.orders, totals.clicks),
      aov: totals.orders ? totals.revenue / totals.orders : 0,
    },
    segments,
    items,
    rowCount: scoped.length,
  };
}
