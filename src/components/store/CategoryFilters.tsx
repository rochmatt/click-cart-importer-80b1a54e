import { Search, SlidersHorizontal, Star, X } from "lucide-react";

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

interface Props {
  value: CategoryFilterState;
  onChange: (next: CategoryFilterState) => void;
  priceBounds: { min: number; max: number };
}

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

export function CategoryFilters({ value, onChange, priceBounds }: Props) {
  const set = <K extends keyof CategoryFilterState>(key: K, v: CategoryFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const count = activeFilterCount(value);

  return (
    <section
      aria-label="Filter produk"
      className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Filter
          {count > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </h2>
        {count > 0 ? (
          <button
            type="button"
            onClick={() => onChange(emptyCategoryFilters)}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label
            htmlFor="category-search"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Cari di kategori ini
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="category-search"
              type="search"
              value={value.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Nama atau deskripsi produk"
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Rentang harga (Rp {idr(priceBounds.min)} – {idr(priceBounds.max)})
          </span>
          <div className="flex items-center gap-2">
            <input
              aria-label="Harga minimum"
              inputMode="numeric"
              value={value.minPrice}
              onChange={(e) => set("minPrice", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Min"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <span className="text-sm text-muted-foreground">–</span>
            <input
              aria-label="Harga maksimum"
              inputMode="numeric"
              value={value.maxPrice}
              onChange={(e) => set("maxPrice", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Max"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Rating minimum
          </span>
          <div
            role="group"
            aria-label="Rating minimum"
            className="flex flex-wrap items-center gap-2"
          >
            {ratingOptions.map((r) => {
              const active = value.minRating === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set("minRating", r)}
                  className={`inline-flex h-10 items-center gap-1 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {r === 0 ? (
                    "Semua"
                  ) : (
                    <>
                      <Star
                        className={`h-3.5 w-3.5 ${active ? "" : "text-amber-500"}`}
                        fill="currentColor"
                        aria-hidden="true"
                      />
                      {r}+
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
