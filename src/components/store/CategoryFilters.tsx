import { useId } from "react";
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

  const uid = useId();
  const count = activeFilterCount(value);

  return (
    <section
      aria-labelledby={`${uid}-heading`}
      className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id={`${uid}-heading`}
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Filter produk
          {count > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </h2>
        <button
          type="button"
          onClick={() => onChange(emptyCategoryFilters)}
          disabled={count === 0}
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Reset filter
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {count === 0 ? "Tidak ada filter aktif." : `${count} filter aktif.`}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label
            htmlFor={`${uid}-search`}
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
              id={`${uid}-search`}
              type="search"
              value={value.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Nama atau deskripsi produk"
              aria-describedby={`${uid}-search-hint`}
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <p id={`${uid}-search-hint`} className="mt-1.5 text-xs text-muted-foreground">
            Mencari pada nama dan deskripsi produk di kategori ini.
          </p>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Rentang harga
          </legend>
          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-min`} className="sr-only">
              Harga minimum dalam rupiah
            </label>
            <input
              id={`${uid}-min`}
              inputMode="numeric"
              value={value.minPrice}
              onChange={(e) => set("minPrice", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Min"
              aria-describedby={`${uid}-price-hint`}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span aria-hidden="true" className="text-sm text-muted-foreground">
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
              placeholder="Max"
              aria-describedby={`${uid}-price-hint`}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <p id={`${uid}-price-hint`} className="mt-1.5 text-xs text-muted-foreground">
            Harga di kategori ini: Rp {idr(priceBounds.min)} – Rp {idr(priceBounds.max)}.
          </p>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Rating minimum
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            {ratingOptions.map((r) => {
              const active = value.minRating === r;
              const id = `${uid}-rating-${String(r).replace(".", "-")}`;
              return (
                <div key={r} className="relative">
                  <input
                    type="radio"
                    id={id}
                    name={`${uid}-rating`}
                    value={r}
                    checked={active}
                    onChange={() => set("minRating", r)}
                    className="peer absolute h-px w-px opacity-0"
                  />
                  <label
                    htmlFor={id}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border px-3 text-sm font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/40 hover:text-primary"
                    }`}
                  >
                    {r === 0 ? (
                      "Semua rating"
                    ) : (
                      <>
                        <Star
                          className={`h-3.5 w-3.5 ${active ? "" : "text-amber-500"}`}
                          fill="currentColor"
                          aria-hidden="true"
                        />
                        <span>{r}+ bintang</span>
                      </>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
