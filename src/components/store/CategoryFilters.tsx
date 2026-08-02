import React, { useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, HelpCircle, LayoutList, ListFilter, Search, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface CategoryFilterState {
  query: string;
  minPrice: string;
  maxPrice: string;
  minRating: number;
}

export const emptyCategoryFilters: CategoryFilterState = {
  query: "",
  minPrice: "",
  maxPrice: "",
  minRating: 0,
};

export const ratingOptions = [0, 3.5, 4, 4.5] as const;

export function activeFilterCount(f: CategoryFilterState) {
  return (
    (f.query.trim() ? 1 : 0) +
    (f.minPrice.trim() ? 1 : 0) +
    (f.maxPrice.trim() ? 1 : 0) +
    (f.minRating > 0 ? 1 : 0)
  );
}

export interface CategoryGroup {
  title: string;
  items: { slug: string; label: string }[];
}

interface Props {
  value: CategoryFilterState;
  onChange: (next: CategoryFilterState) => void;
  priceBounds: { min: number; max: number };
  className?: string;
  variant?: "default" | "sidebar";
  groups?: CategoryGroup[];
  activeSlug?: string;
  activeLabel?: string;
  subcategories?: string[];
  collapsedGroups?: Record<string, boolean>;
  onToggleGroup?: (title: string) => void;
  /** Result counts per option so users see what is available. */
  categoryCounts?: Record<string, number>;
  subcategoryCounts?: Record<string, number>;
  ratingCounts?: Record<string, number>;
}

/** Small trailing count badge for a filter option. */
function CountBadge({ count }: { count: number }) {
  return (
    <span
      className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground"
      aria-hidden="true"
    >
      {count}
    </span>
  );
}


const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

/** Collapsible "Lainnya" list wrapper — shows the first `limit` children only. */
function MoreList({
  children,
  limit = 4,
  label,
}: {
  children: React.ReactNode[];
  limit?: number;
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? children : children.slice(0, limit);
  const hasMore = children.length > limit;
  const hiddenItems = children.slice(limit);

  return (
    <div>
      <ul className="space-y-0.5">{visible}</ul>
      {hasMore ? (
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="inline-flex min-h-10 items-center gap-1 pl-1 text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {expanded ? "Lebih sedikit" : "Lainnya"}
            {expanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="sr-only">{label}</span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                aria-label={`Lihat subkategori tersembunyi untuk ${label}`}
              >
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="mb-1 font-semibold">{expanded ? "Semua item ditampilkan" : `${hiddenItems.length} item tersembunyi`}</p>
              {!expanded ? (
                <ul className="space-y-0.5">
                  {hiddenItems.map((item, idx) => {
                    const key = React.isValidElement(item) ? item.key ?? idx : idx;
                    const text = React.isValidElement(item)
                      ? (item.props.children as React.ReactElement)?.props?.children ?? item.props.label
                      : null;
                    return (
                      <li key={key} className="text-xs">
                        • {text}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </TooltipContent>
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
}

export function CategoryFilters({
  value,
  onChange,
  priceBounds,
  className,
  groups,
  activeSlug,
  activeLabel,
  subcategories,
  categoryCounts,
  subcategoryCounts,
  ratingCounts,
}: Props) {
  const set = <K extends keyof CategoryFilterState>(key: K, v: CategoryFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const uid = useId();
  const count = activeFilterCount(value);

  const allCategories = useMemo(
    () => (groups ?? []).flatMap((g) => g.items),
    [groups],
  );

  return (
    <section
      aria-labelledby={`${uid}-heading`}
      className={cn(
        "rounded-2xl border border-border bg-card px-4 py-5 sm:px-5",
        className,
      )}
    >
      {/* Semua Kategori */}
      <h2
        id={`${uid}-heading`}
        className="flex items-center gap-2 text-base font-bold text-foreground"
      >
        <LayoutList className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Semua Kategori
      </h2>

      {activeLabel ? (
        <div className="mt-4 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
            <span aria-hidden="true" className="text-[10px]">
              ▶
            </span>
            {activeLabel}
          </p>
          {subcategories && subcategories.length > 0 ? (
            <div className="mt-2 pl-4">
              <MoreList label={`subkategori ${activeLabel}`} limit={5}>
                {subcategories.map((sub) => {
                  const n = subcategoryCounts?.[sub];
                  return (
                    <li key={sub}>
                      <Link
                        to="/search"
                        search={{ q: sub }}
                        aria-label={
                          n === undefined ? sub : `${sub}, ${n} produk`
                        }
                        className={cn(
                          "flex min-h-10 items-center gap-2 py-2 text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                          n === 0 && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate">{sub}</span>
                        {n !== undefined ? <CountBadge count={n} /> : null}
                      </Link>
                    </li>
                  );
                })}
              </MoreList>
            </div>
          ) : null}
        </div>
      ) : null}

      {allCategories.length > 0 ? (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-1 text-sm font-bold text-foreground">Kategori lain</p>
          <MoreList label="kategori lain" limit={4}>
            {allCategories
              .filter((c) => c.slug !== activeSlug)
              .map((c) => {
                const n = categoryCounts?.[c.slug];
                return (
                  <li key={c.slug}>
                    <Link
                      to="/category/$slug"
                      params={{ slug: c.slug }}
                      aria-label={
                        n === undefined ? c.label : `${c.label}, ${n} produk`
                      }
                      className={cn(
                        "flex min-h-10 items-center gap-2 py-2 text-sm text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        n === 0 && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">{c.label}</span>
                      {n !== undefined ? <CountBadge count={n} /> : null}
                    </Link>
                  </li>
                );
              })}
          </MoreList>
        </div>
      ) : null}


      {/* FILTER */}
      <div className="mt-5 border-t border-border pt-5">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground">
          <ListFilter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Filter
          {count > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </h3>

        <p aria-live="polite" className="sr-only">
          {count === 0 ? "Tidak ada filter aktif." : `${count} filter aktif.`}
        </p>

        {/* Pencarian */}
        <div className="mt-4">
          <label
            htmlFor={`${uid}-search`}
            className="mb-1.5 block text-sm font-semibold text-foreground"
          >
            Cari di kategori ini
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id={`${uid}-search`}
              type="search"
              value={value.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Nama atau deskripsi produk"
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* Harga */}
        <fieldset className="mt-5">
          <legend className="mb-1.5 block text-sm font-semibold text-foreground">
            Rentang harga
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor={`${uid}-min`} className="sr-only">
              Harga minimum dalam rupiah
            </label>
            <input
              id={`${uid}-min`}
              inputMode="numeric"
              value={value.minPrice}
              onChange={(e) => set("minPrice", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Harga minimum"
              aria-describedby={`${uid}-price-hint`}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span aria-hidden="true" className="hidden text-sm text-muted-foreground sm:inline">
              –
            </span>
            <label htmlFor={`${uid}-max`} className="sr-only">
              Harga maksimum dalam rupiah
            </label>
            <input
              id={`${uid}-max`}
              inputMode="numeric"
              value={value.maxPrice}
              onChange={(e) => set("maxPrice", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Harga maksimum"
              aria-describedby={`${uid}-price-hint`}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <p id={`${uid}-price-hint`} className="mt-1.5 text-xs text-muted-foreground">
            Rp {idr(priceBounds.min)} – Rp {idr(priceBounds.max)}
          </p>
        </fieldset>

        {/* Rating — checkbox-style vertical list */}
        <fieldset className="mt-5">
          <legend className="mb-1.5 block text-sm font-semibold text-foreground">
            Rating minimum
          </legend>
          <div className="space-y-0.5">
            {ratingOptions.map((r) => {
              const active = value.minRating === r;
              const id = `${uid}-rating-${String(r).replace(".", "-")}`;
              const n = ratingCounts?.[String(r)];
              const unavailable = n === 0 && !active;
              return (
                <div key={r} className="relative flex items-center">
                  <input
                    type="radio"
                    id={id}
                    name={`${uid}-rating`}
                    value={r}
                    checked={active}
                    disabled={unavailable}
                    onChange={() => set("minRating", r)}
                    aria-label={
                      (r === 0 ? "Semua rating" : `${r} bintang ke atas`) +
                      (n !== undefined ? `, ${n} produk` : "")
                    }
                    className="peer absolute h-px w-px opacity-0"
                  />
                  <label
                    htmlFor={id}
                    className={cn(
                      "inline-flex min-h-10 w-full items-center gap-2.5 rounded-md px-1 text-sm text-foreground transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                      unavailable
                        ? "cursor-not-allowed text-muted-foreground opacity-60"
                        : "cursor-pointer hover:text-primary",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background",
                      )}
                    >
                      {active ? (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-current stroke-2">
                          <path d="M2.5 6.5 5 9l4.5-5.5" strokeLinecap="round" />
                        </svg>
                      ) : null}
                    </span>
                    {r === 0 ? (
                      "Semua rating"
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Star
                          className="h-3.5 w-3.5 text-amber-500"
                          fill="currentColor"
                          aria-hidden="true"
                        />
                        {r} ke atas
                      </span>
                    )}
                    {n !== undefined ? <CountBadge count={n} /> : null}
                  </label>
                </div>
              );
            })}

          </div>
        </fieldset>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <button
          type="button"
          onClick={() => onChange(emptyCategoryFilters)}
          disabled={count === 0}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-bold uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-40"
        >
          Hapus semua
        </button>
      </div>
    </section>
  );
}
