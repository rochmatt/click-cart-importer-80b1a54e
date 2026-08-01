import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useCatalog } from "@/lib/catalog";
import type { Product } from "@/data/products";
import { ProductCard } from "./ProductCard";
import { ProductGridSkeleton } from "./ProductSkeleton";

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
  const { products } = useCatalog();
  const [tab, setTab] = useState<Tab>("For You");
  const [count, setCount] = useState(PAGE);
  const [isLoading, setIsLoading] = useState(true);
  const sentinel = useRef<HTMLDivElement>(null);
  const term = query.trim().toLowerCase();

  const base = useMemo(() => {
    const ordered = orderFor(tab, products);
    if (!term) return ordered;
    return ordered.filter((p) => p.title.toLowerCase().includes(term));
  }, [tab, term, products]);

  // Simulated infinite feed: recycle the catalog as the user keeps scrolling.
  const visible = useMemo(() => {
    if (!base.length) return [];
    return Array.from({ length: Math.min(count, base.length * 5) }, (_, i) => ({
      product: base[i % base.length],
      key: `${base[i % base.length].id}-${i}`,
    }));
  }, [base, count]);

  const hasMore = base.length > 0 && visible.length < base.length * 5;

  useEffect(() => setCount(PAGE), [tab, term]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

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

      <div className="mx-auto max-w-7xl px-3 pt-5 sm:px-6 lg:px-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
          <Sparkles className="h-5 w-5 text-primary" />
          {term ? `Results for "${query.trim()}"` : "Daily Discover"}
        </h2>

        {isLoading ? (
          <ProductGridSkeleton count={10} />
        ) : visible.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5 lg:gap-5">
              {visible.map(({ product, key }) => (
                <ProductCard key={key} product={product} />
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
          <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="mt-4 text-base font-semibold text-foreground">
              No products match your search
            </p>
            <p className="mt-1 max-w-xs mx-auto text-sm text-muted-foreground">
              Try a different keyword, switch tabs, or browse categories to find what you need.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
