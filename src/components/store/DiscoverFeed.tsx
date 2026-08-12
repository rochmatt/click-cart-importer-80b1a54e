import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useCatalog } from "@/lib/catalog";
import type { Product } from "@/data/products";
import {
  type FeedFilter,
  type FeedSort,
  chipFilterFeed,
  cocokFilterFeed,
  FEED_FILTER_KOSONG,
  feedFilterAktif,
  ringkasanFilterFeed,
  urutkanFeed,
} from "@/lib/discover-feed-filter";
import { ProductCard } from "./ProductCard";
import { ProductGridSkeleton } from "./ProductSkeleton";
import { BestSellersRail } from "./BestSellersRail";
import { CategoryBanner } from "./CategoryBanner";
import { QuickViewModal } from "./QuickViewModal";

const tabs = ["For You", "Best Sellers", "New Arrivals"] as const;
type Tab = (typeof tabs)[number];

const PAGE = 8;

function orderFor(tab: Tab, products: Product[]) {
  const list = [...products];
  if (tab === "Best Sellers") return list.sort((a, b) => b.reviews - a.reviews);
  if (tab === "New Arrivals") return list.slice().reverse();
  return list;
}

export function DiscoverFeed({ query }: { query: string }) {
  // isLoading datang dari pemuatan katalog yang SEBENARNYA.
  //
  // Sebelumnya berkas ini memakai timer palsu: useState(true) lalu
  // setTimeout(…, 600) yang tidak ada kaitannya dengan ketersediaan data.
  // Beranda karenanya menahan produk selama 600 milidetik penuh meskipun
  // datanya sudah siap — menunda LCP tanpa menukar apa pun, lalu menggeser
  // layout saat 10 kerangka digantikan 8 kartu.
  const { products, isLoading } = useCatalog();
  const [tab, setTab] = useState<Tab>("For You");
  const [filter, setFilter] = useState<FeedFilter>(FEED_FILTER_KOSONG);
  const [sort, setSort] = useState<FeedSort>("relevance");
  const [count, setCount] = useState(PAGE);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const term = query.trim().toLowerCase();

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const base = useMemo(() => {
    const ordered = orderFor(tab, products).filter((p) => cocokFilterFeed(p, filter));
    const found = term ? ordered.filter((p) => p.title.toLowerCase().includes(term)) : ordered;
    return urutkanFeed(found, sort);
  }, [tab, term, products, filter, sort]);

  const removeChip = (key: "category" | "minRating" | "price") =>
    setFilter((f) =>
      key === "category"
        ? { ...f, category: "all" }
        : key === "minRating"
          ? { ...f, minRating: 0 }
          : { ...f, minPrice: 0, maxPrice: 0 },
    );

  // Simulated infinite feed: recycle the catalog as the user keeps scrolling.
  const visible = useMemo(() => {
    if (!base.length) return [];
    return Array.from({ length: Math.min(count, base.length * 5) }, (_, i) => ({
      product: base[i % base.length],
      key: `${base[i % base.length].id}-${i}`,
    }));
  }, [base, count]);

  const hasMore = base.length > 0 && visible.length < base.length * 5;

  useEffect(() => setCount(PAGE), [tab, term, filter, sort]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(() => setCount((c) => c + PAGE), 400);
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visible.length]);

  return (
    <section id="products" className="bg-secondary/60 pb-14 pt-4">
      {/* Banner header di atas tab (dari mock: .cat-banner). */}
      <CategoryBanner />

      <div className="sticky top-[60px] z-30 -mx-0 border-y border-border bg-background/95 backdrop-blur sm:top-[68px]">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={t === tab}
              className={`relative shrink-0 px-4 py-3 text-sm font-semibold transition-colors ${
                t === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              {t === tab && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Rail "Terlaris di Kategori Ini" — di bawah tab, di atas panel filter. */}
      <BestSellersRail products={products} />

      <div className="mx-auto max-w-7xl px-3 pt-5 sm:px-6 lg:px-8">
        {/* Panel filter produk: kategori + rating + harga. Menyaring feed langsung
            (instan, tanpa submit); chip visual + region aria-live untuk status. */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <p className="flex items-center gap-1.5 self-center text-sm font-bold text-foreground">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Filter
            </p>
            <div>
              <label
                htmlFor="feed-category"
                className="mb-1 block text-xs font-semibold text-muted-foreground"
              >
                Kategori
              </label>
              <select
                id="feed-category"
                value={filter.category}
                onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="feed-sort"
                className="mb-1 block text-xs font-semibold text-muted-foreground"
              >
                Urutkan
              </label>
              <select
                id="feed-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as FeedSort)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              >
                <option value="relevance">Relevansi</option>
                <option value="price_asc">Harga termurah</option>
                <option value="price_desc">Harga termahal</option>
              </select>
            </div>
            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                Rating minimal
              </legend>
              <div role="radiogroup" aria-label="Rating minimal" className="flex gap-1">
                {[0, 3, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={filter.minRating === r}
                    onClick={() => setFilter((f) => ({ ...f, minRating: r }))}
                    className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      filter.minRating === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                    {r === 0 ? "Semua" : `${r}+`}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Harga (Rp)
              </span>
              <div className="flex items-center gap-1">
                <input
                  inputMode="numeric"
                  aria-label="Harga minimum"
                  placeholder="Min"
                  value={filter.minPrice || ""}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      minPrice: Number(e.target.value.replace(/[^\d]/g, "")) || 0,
                    }))
                  }
                  className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
                <span aria-hidden="true" className="text-muted-foreground">
                  –
                </span>
                <input
                  inputMode="numeric"
                  aria-label="Harga maksimum"
                  placeholder="Maks"
                  value={filter.maxPrice || ""}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      maxPrice: Number(e.target.value.replace(/[^\d]/g, "")) || 0,
                    }))
                  }
                  className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
            {feedFilterAktif(filter) && (
              <button
                type="button"
                onClick={() => setFilter(FEED_FILTER_KOSONG)}
                className="ml-auto h-9 self-end rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Reset
              </button>
            )}
          </div>

          {feedFilterAktif(filter) && (
            <div className="mt-3 flex flex-wrap items-center gap-2" aria-hidden="true">
              {chipFilterFeed(filter).map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => removeChip(chip.key)}
                    className="grid h-4 w-4 place-items-center rounded-full hover:bg-foreground/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Status untuk screen reader — diumumkan saat filter berubah. */}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {ringkasanFilterFeed(filter, base.length)}
          </p>
        </div>

        <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
          <Sparkles className="h-5 w-5 text-primary" />
          {term ? `Results for "${query.trim()}"` : "Daily Discover"}
        </h2>

        {isLoading ? (
          <ProductGridSkeleton count={PAGE} />
        ) : visible.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5 lg:gap-5">
              {visible.map(({ product, key }) => (
                <ProductCard key={key} product={product} onQuickView={setQuickView} />
              ))}
            </div>
            <div ref={sentinel} className="flex h-16 items-center justify-center">
              {hasMore ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <p className="text-xs text-muted-foreground">You have reached the end</p>
              )}
            </div>
          </>
        ) : (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-2xl border border-dashed border-border bg-card py-16 text-center"
          >
            <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="mt-4 text-base font-semibold text-foreground">
              No products match your search
            </p>
            <p className="mt-1 max-w-xs mx-auto text-sm text-muted-foreground">
              Try a different keyword, switch tabs, or browse categories to find what you need.
            </p>
            {feedFilterAktif(filter) && (
              <button
                type="button"
                onClick={() => setFilter(FEED_FILTER_KOSONG)}
                className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Reset Filter
              </button>
            )}
          </div>
        )}
      </div>

      <QuickViewModal
        product={quickView}
        open={quickView !== null}
        onOpenChange={(open) => !open && setQuickView(null)}
      />
    </section>
  );
}
