import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, PackageSearch } from "lucide-react";
import { CategoryFilters, emptyCategoryFilters } from "@/components/store/CategoryFilters";
import type { CategoryFilterState } from "@/components/store/CategoryFilters";
import {
  categoryCatalog,
  findCategory,
  productsInCategory,
} from "@/data/categories";
import { ProductCard } from "@/components/store/ProductCard";
import { QuickViewModal } from "@/components/store/QuickViewModal";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { ChatFab } from "@/components/store/ChatFab";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import type { Product } from "@/data/products";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  jsonLdScript,
} from "@/lib/structured-data";

type SortKey = "popular" | "rating" | "price-low" | "price-high";

const priceValue = (price: string) => Number(price.replace(/[^\d]/g, "")) || 0;

const idrCompact = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

export const Route = createFileRoute("/category/$slug")({
  loader: ({ params }) => {
    const category = findCategory(params.slug);
    if (!category) throw notFound();
    const products = productsInCategory(category.label);
    const prices = products.map((p) => priceValue(p.price)).filter((n) => n > 0);
    return {
      ...category,
      productCount: products.length,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      topRating: products.reduce((m, p) => Math.max(m, p.rating), 0),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      const title = "Kategori tidak ditemukan — PasarPilih";
      const description = "Kategori ini tidak tersedia di PasarPilih.";
      return {
        meta: [
          { title },
          { name: "description", content: description },
          { property: "og:title", content: title },
          { property: "og:description", content: description },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
          { name: "robots", content: "noindex" },
        ],
        links: [],
        scripts: [],
      };
    }

    const path = `/category/${loaderData.slug}`;
    const priceRange =
      loaderData.maxPrice > 0
        ? ` Harga Rp${idrCompact(loaderData.minPrice)}–Rp${idrCompact(loaderData.maxPrice)}.`
        : "";
    const title = `${loaderData.label} — ${loaderData.productCount} Produk Terbaik | PasarPilih`;
    const description =
      `${loaderData.blurb} Bandingkan ${loaderData.productCount} produk ${loaderData.label.toLowerCase()} ` +
      `dari Shopee, Tokopedia, dan TikTok Shop.${priceRange} Filter harga, rating, dan pencarian.`.slice(
        0,
        320,
      );

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: path },
        { property: "og:site_name", content: "PasarPilih" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: path }],
      scripts: [
        jsonLdScript(
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: loaderData.label, path },
          ]),
        ),
        jsonLdScript(itemListJsonLd(loaderData.label, productsInCategory(loaderData.label))),
      ],
    };
  },
  component: CategoryPage,
  notFoundComponent: CategoryNotFound,
});

function CategoryPage() {
  const category = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CategoryFilterState>(emptyCategoryFilters);
  const [sort, setSort] = useState<SortKey>("popular");
  const [quickView, setQuickView] = useState<Product | null>(null);

  const all = useMemo(() => productsInCategory(category.label), [category.label]);

  const priceBounds = useMemo(() => {
    const values = all.map((p) => priceValue(p.price));
    return {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
    };
  }, [all]);

  const searchTerm = (filters.query.trim() || query.trim()).toLowerCase();

  const items = useMemo(() => {
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;
    const list = all.filter((p) => {
      if (
        searchTerm &&
        !p.title.toLowerCase().includes(searchTerm) &&
        !p.description.toLowerCase().includes(searchTerm)
      )
        return false;
      const value = priceValue(p.price);
      if (min !== null && value < min) return false;
      if (max !== null && max > 0 && value > max) return false;
      if (filters.minRating > 0 && p.rating < filters.minRating) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    else if (sort === "price-low")
      sorted.sort((a, b) => priceValue(a.price) - priceValue(b.price));
    else if (sort === "price-high")
      sorted.sort((a, b) => priceValue(b.price) - priceValue(a.price));
    else sorted.sort((a, b) => b.reviews - a.reviews);
    return sorted;
  }, [all, searchTerm, filters.minPrice, filters.maxPrice, filters.minRating, sort]);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto max-w-7xl px-4 py-8 pb-36 sm:px-6 sm:pb-24 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link to="/" className="transition-colors hover:text-primary">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground" aria-current="page">
              {category.label}
            </li>
          </ol>
        </nav>

        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {category.label}: {category.productCount} Produk Pilihan
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {category.blurb}
          {category.maxPrice > 0
            ? ` Rentang harga Rp${idrCompact(category.minPrice)}–Rp${idrCompact(category.maxPrice)}${
                category.topRating > 0 ? `, rating hingga ${category.topRating}` : ""
              }.`
            : ""}
        </p>

        <div className="mt-6 lg:grid lg:grid-cols-[280px_1fr] lg:gap-8 lg:items-start">
          <aside className="lg:sticky lg:top-32 lg:self-start space-y-6">
            <CategoryFilters
              value={filters}
              onChange={setFilters}
              priceBounds={priceBounds}
              variant="sidebar"
              className="mt-0"
            />
          </aside>

          <div className="mt-6 space-y-6 lg:mt-0">
            <nav aria-label="All categories">
              <ul className="-mx-4 flex snap-x snap-mandatory items-center gap-3 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:mx-0 sm:px-0 sm:py-3 lg:flex-wrap lg:justify-center lg:overflow-visible [&::-webkit-scrollbar]:hidden">
                {categoryCatalog.map((c) => {
                  const active = c.slug === category.slug;
                  return (
                    <li key={c.slug} className="shrink-0 snap-start">
                      <Link
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        aria-current={active ? "page" : undefined}
                        className={`inline-flex h-10 w-[8.5rem] shrink-0 items-center justify-center truncate rounded-full border px-3 text-center text-sm font-medium leading-none transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-secondary text-foreground hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {items.length} product{items.length === 1 ? "" : "s"}
                {searchTerm ? ` matching “${searchTerm}”` : ""}
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="category-sort" className="text-sm text-muted-foreground">
                  Sort by
                </label>
                <select
                  id="category-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                >
                  <option value="popular">Most reviewed</option>
                  <option value="rating">Top rated</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                </select>
              </div>
            </div>

            {items.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} onQuickView={setQuickView} />
                ))}
              </div>
            ) : (
              <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
                <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 font-semibold text-foreground">No products here yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another category or clear your search.
                </p>
                <Link
                  to="/"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Browse all products
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <QuickViewModal
        product={quickView}
        open={quickView !== null}
        onOpenChange={(open) => !open && setQuickView(null)}
      />

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}

function CategoryNotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Category not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The category you are looking for is no longer available.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
