import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, PackageSearch, SearchX, Sparkles } from "lucide-react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { ChatFab } from "@/components/store/ChatFab";
import { ProductCard } from "@/components/store/ProductCard";
import { QuickViewModal } from "@/components/store/QuickViewModal";
import { ProductFilters, type ProductFilterState } from "@/components/store/ProductFilters";
import { ProductGridSkeleton } from "@/components/store/ProductSkeleton";
import { products as seedProducts, type Product } from "@/data/products";
import { useCatalog } from "@/lib/catalog";

const searchSchema = z.object({
  q: z.string().optional().default(""),
});

type SortKey = "relevance" | "rating" | "price-low" | "price-high" | "reviews";

const priceValue = (price: string) => Number(price.replace(/[^\d]/g, "")) || 0;
const maxProductPrice = Math.max(...seedProducts.map((p) => priceValue(p.price)));

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  head: () => {
    const title = "Search products — PasarPilih";
    const description = "Find deals, compare prices and filter products by category, price range and rating on PasarPilih.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { products } = useCatalog();
  const [sort, setSort] = useState<SortKey>("relevance");
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ProductFilterState>({
    categories: [],
    priceRange: [0, maxProductPrice],
    minRating: null,
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, [q]);

  const term = q.trim().toLowerCase();

  const results = useMemo(() => {
    const list = products.filter((p) => {
      if (term && !p.title.toLowerCase().includes(term)) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(p.category)) return false;
      const price = priceValue(p.price);
      if (price < filters.priceRange[0] || price > filters.priceRange[1]) return false;
      if (filters.minRating !== null && p.rating < filters.minRating) return false;
      return true;
    });

    const sorted = [...list];
    if (sort === "price-low") sorted.sort((a, b) => priceValue(a.price) - priceValue(b.price));
    else if (sort === "price-high") sorted.sort((a, b) => priceValue(b.price) - priceValue(a.price));
    else if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    else if (sort === "reviews") sorted.sort((a, b) => b.reviews - a.reviews);
    return sorted;
  }, [term, filters, sort, products]);

  const activeFilterCount =
    filters.categories.length +
    (filters.minRating ? 1 : 0) +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < maxProductPrice ? 1 : 0);

  const updateQuery = (value: string) => {
    navigate({ to: "/search", search: { q: value || undefined } });
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={q} onQueryChange={updateQuery} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link to="/" className="transition-colors hover:text-primary">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground" aria-current="page">
              Search
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {term ? `Search results for "${q.trim()}"` : "Search products"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {results.length} product{results.length === 1 ? "" : "s"} found
              {term ? ` for "${q.trim()}"` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="search-sort" className="text-sm text-muted-foreground">
              Sort by
            </label>
            <select
              id="search-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              <option value="relevance">Relevance</option>
              <option value="reviews">Most reviewed</option>
              <option value="rating">Top rated</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
        </div>

        <ProductFilters value={filters} onChange={setFilters} maxPrice={maxProductPrice} />

        {isLoading ? (
          <div className="mt-2">
            <ProductGridSkeleton count={10} />
          </div>
        ) : results.length > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-5 lg:gap-5">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} onQuickView={setQuickView} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            {term || activeFilterCount > 0 ? (
              <>
                <SearchX className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <p className="mt-4 text-lg font-semibold text-foreground">No products found</p>
                <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground">
                  We couldn’t find anything matching your search and filters. Try a different keyword or loosen your filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilters({
                      categories: [],
                      priceRange: [0, maxProductPrice],
                      minRating: null,
                    });
                    navigate({ search: { q: undefined } });
                  }}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Clear search & filters
                </button>
              </>
            ) : (
              <>
                <Sparkles className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
                <p className="mt-4 text-lg font-semibold text-foreground">Start searching</p>
                <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground">
                  Type a product name in the search box above or pick a trending keyword to discover deals.
                </p>
              </>
            )}
          </div>
        )}

        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </main>

      <QuickViewModal
        product={quickView}
        open={quickView !== null}
        onOpenChange={(open) => !open && setQuickView(null)}
      />

      <Footer />
      <ChatFab />
    </div>
  );
}
