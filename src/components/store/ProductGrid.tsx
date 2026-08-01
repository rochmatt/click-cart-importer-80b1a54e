import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { products, type Product } from "@/data/products";
import { ProductCard } from "./ProductCard";
import { QuickViewModal } from "./QuickViewModal";
import { ProductGridSkeleton } from "./ProductSkeleton";

interface ProductGridProps {
  query: string;
}

export function ProductGrid({ query }: ProductGridProps) {
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.title.toLowerCase().includes(term));
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <section id="products" className="bg-background py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {query.trim() ? `Results for “${query.trim()}”` : "Trending this week"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {query.trim()
                ? `${filtered.length} product${filtered.length === 1 ? "" : "s"} found`
                : "Buy from the marketplace you trust most."}
            </p>
          </div>
          <a
            href="#products"
            className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            View all
          </a>
        </div>

        {isLoading ? (
          <ProductGridSkeleton count={8} />
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} onQuickView={setQuickView} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="mt-4 text-base font-semibold text-foreground">
              No products match “{query.trim()}”
            </p>
            <p className="mt-1 max-w-xs mx-auto text-sm text-muted-foreground">
              Try a different product name or clear your search to browse our full catalog.
            </p>
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
