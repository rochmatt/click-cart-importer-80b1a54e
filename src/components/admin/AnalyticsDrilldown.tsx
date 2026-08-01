import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { DateRange } from "react-day-picker";
import { Check, CalendarIcon, Download, ExternalLink, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  channelLabel,
  drillDown,
  formatCompactIDR,
  formatIDR,
  type DrillSelection,
  type SalesRow,
} from "@/lib/sales-analytics";

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function fromISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function DateRangeControl({
  selection,
  minDate,
  maxDate,
  onChange,
}: {
  selection: Extract<DrillSelection, { type: "date" | "range" }>;
  minDate?: Date;
  maxDate?: Date;
  onChange: (sel: DrillSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const value: DateRange =
    selection.type === "date"
      ? { from: fromISO(selection.value), to: fromISO(selection.value) }
      : { from: fromISO(selection.from), to: fromISO(selection.to) };

  const label =
    selection.type === "date"
      ? longDate(selection.value)
      : selection.from === selection.to
        ? longDate(selection.from)
        : `${shortDate(selection.from)} – ${longDate(selection.to)}`;

  function handleSelect(next: DateRange | undefined) {
    if (!next?.from) return;
    const from = toISO(next.from);
    const to = toISO(next.to ?? next.from);
    onChange(from === to ? { type: "date", value: from } : { type: "range", from, to });
    if (next.to) setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 justify-start gap-2 text-xs font-medium">
            <CalendarIcon className="h-3.5 w-3.5" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={value.from}
            selected={value}
            onSelect={handleSelect}
            disabled={{ before: minDate as Date, after: maxDate as Date }}
            numberOfMonths={1}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {selection.type === "range" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onChange({ type: "date", value: selection.to })}
        >
          Single day
        </Button>
      )}
    </div>
  );
}

function csvCell(v: string | number) {
  const str = String(v);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function selectionSlug(sel: DrillSelection) {
  if (sel.type === "date") return sel.value;
  if (sel.type === "range") return `${sel.from}_to_${sel.to}`;
  return sel.value;
}

function downloadCsv(
  sel: DrillSelection,
  result: ReturnType<typeof drillDown>,
) {
  const scopeLabel =
    sel.type === "date"
      ? sel.value
      : sel.type === "range"
        ? `${sel.from} to ${sel.to}`
        : channelLabel(sel.value);

  const lines: string[] = [];
  lines.push(["Section", "Scope", "Name", "Views", "Clicks", "Orders", "Conversion %", "Revenue (IDR)"].join(","));
  lines.push(
    ["Totals", scopeLabel, "All", result.totals.views, result.totals.clicks, result.totals.orders, result.totals.conversion.toFixed(2), result.totals.revenue]
      .map(csvCell)
      .join(","),
  );
  for (const s of result.segments) {
    lines.push(
      [
        sel.type === "date" ? "Marketplace" : "Day",
        scopeLabel,
        sel.type === "date" ? s.label : s.key,
        s.views,
        s.clicks,
        s.orders,
        s.conversion.toFixed(2),
        s.revenue,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  for (const p of result.items) {
    lines.push(
      ["Product", scopeLabel, p.title, p.views, p.clicks, p.orders, p.conversion.toFixed(2), p.revenue]
        .map(csvCell)
        .join(","),
    );
  }

  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-drilldown-${selectionSlug(sel)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    toast.success("Shareable link copied", {
      description: (
        <span className="block max-w-[320px] truncate" title={url}>
          {url}
        </span>
      ),
      action: {
        label: (
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Open link
          </span>
        ),
        onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
      },
    });
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" className="h-8 gap-2 text-xs font-medium" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

function OpenLinkButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-2 text-xs font-medium"
      onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      Open link
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function AnalyticsDrilldown({
  rows,
  selection,
  onOpenChange,
  onSelectionChange,
}: {
  rows: SalesRow[];
  selection: DrillSelection | null;
  onOpenChange: (open: boolean) => void;
  onSelectionChange: (sel: DrillSelection) => void;
}) {
  const result = selection ? drillDown(rows, selection) : null;

  const bounds = useMemo(() => {
    const dates = rows.map((r) => r.event_date).sort();
    return dates.length
      ? { min: fromISO(dates[0]), max: fromISO(dates[dates.length - 1]) }
      : { min: undefined, max: undefined };
  }, [rows]);

  const dayCount =
    selection?.type === "range"
      ? Math.round(
          (fromISO(selection.to).getTime() - fromISO(selection.from).getTime()) / 86_400_000,
        ) + 1
      : 1;

  return (
    <Sheet open={!!selection} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {selection && result && (
          <>
            <SheetHeader className="px-4">
              <SheetTitle>
                {selection.type === "date"
                  ? longDate(selection.value)
                  : selection.type === "range"
                    ? `${shortDate(selection.from)} – ${longDate(selection.to)}`
                    : channelLabel(selection.value)}
              </SheetTitle>
              <SheetDescription>
                {selection.type === "channel"
                  ? "Orders and products recorded on this marketplace over the selected range."
                  : selection.type === "range"
                    ? `Orders and products recorded across ${dayCount} days on all marketplaces.`
                    : "Orders and products recorded on this day across all marketplaces."}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {selection.type !== "channel" && (
                  <DateRangeControl
                    selection={selection}
                    minDate={bounds.min}
                    maxDate={bounds.max}
                    onChange={onSelectionChange}
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 text-xs font-medium"
                  disabled={result.rowCount === 0}
                  onClick={() => downloadCsv(selection, result)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
                <CopyLinkButton />
                <OpenLinkButton />
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Revenue" value={formatIDR(result.totals.revenue)} />
                <Stat label="Orders" value={result.totals.orders.toLocaleString()} />
                <Stat label="Conversion" value={`${result.totals.conversion.toFixed(2)}%`} />
                <Stat label="AOV" value={formatCompactIDR(Math.round(result.totals.aov))} />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-foreground">
                  {selection.type === "date" ? "By marketplace" : "By day"}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                        <th className="px-2.5 py-2 font-medium">
                          {selection.type === "date" ? "Channel" : "Day"}
                        </th>
                        <th className="px-2.5 py-2 text-right font-medium">Clicks</th>
                        <th className="px-2.5 py-2 text-right font-medium">Orders</th>
                        <th className="px-2.5 py-2 text-right font-medium">Conv.</th>
                        <th className="px-2.5 py-2 text-right font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.segments.map((s) => (
                        <tr key={s.key} className="border-b border-border/60 last:border-0">
                          <td className="px-2.5 py-2 font-medium text-foreground">
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              {selection.type === "date" ? s.label : shortDate(s.key)}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">
                            {s.clicks.toLocaleString()}
                          </td>
                          <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">
                            {s.orders.toLocaleString()}
                          </td>
                          <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">
                            {s.conversion.toFixed(2)}%
                          </td>
                          <td className="px-2.5 py-2 text-right tabular-nums font-semibold text-foreground">
                            {formatCompactIDR(s.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-foreground">
                  Products ({result.items.length})
                </h3>
                <ul className="space-y-2">
                  {result.items.map((p) => (
                    <li key={p.ref} className="rounded-lg border border-border p-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-xs font-medium text-foreground">{p.title}</p>
                        <p className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                          {formatCompactIDR(p.revenue)}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {p.orders.toLocaleString()} orders · {p.clicks.toLocaleString()} clicks ·{" "}
                        {p.conversion.toFixed(2)}% conv.
                        {selection.type === "date" && p.topChannel
                          ? ` · top: ${channelLabel(p.topChannel)}`
                          : ""}
                      </p>
                      <Link
                        to="/products/$id"
                        params={{ id: p.ref.replace(/^p/, "") }}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        View product <ExternalLink className="h-3 w-3" />
                      </Link>
                    </li>
                  ))}
                  {result.items.length === 0 && (
                    <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No activity recorded for this selection.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
