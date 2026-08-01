import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ChevronRight, Star, History, RotateCcw } from "lucide-react";
import { products, type Product } from "@/data/products";
import { useImageOverrides } from "@/lib/cover-overrides";
import { clearViewHistory, useRecentlyViewed } from "@/lib/recently-viewed";

interface Pick {
  product: Product;
  reason: string;
}

/**
 * Personalised picks from on-device browsing history: products from the
 * categories the shopper just browsed come first, then highly rated fallbacks
 * so the section is never empty for a first-time visitor.
 */
function buildPicks(viewed: { id: string; category: string }[]): Pick[] {
  const seenIds = new Set(viewed.map((v) => v.id));
  const picks: Pick[] = [];
  const used = new Set<string>();

  for (const entry of viewed) {
    const source = products.find((p) => p.id === entry.id);
    const label = source?.title.split(/[—-]/)[0]?.trim() ?? entry.category;
    for (const candidate of products) {
      if (picks.length >= 8) break;
      if (candidate.category !== entry.category) continue;
      if (seenIds.has(candidate.id) || used.has(candidate.id)) continue;
      used.add(candidate.id);
      picks.push({ product: candidate, reason: `Karena kamu lihat ${label}` });
    }
  }

  const popular = [...products].sort(
    (a, b) => (b.sold ?? 0) - (a.sold ?? 0) || b.rating - a.rating,
  );
  for (const candidate of popular) {
    if (picks.length >= 8) break;
    if (used.has(candidate.id)) continue;
    used.add(candidate.id);
    picks.push({
      product: candidate,
      reason: viewed.length ? "Sering dilihat pembeli lain" : "Populer minggu ini",
    });
  }

  return picks;
}

export function ForYou() {
  const viewed = useRecentlyViewed();
  const { data: overrides } = useImageOverrides();
  const picks = useMemo(() => buildPicks(viewed), [viewed]);
  const personalised = viewed.length > 0;

  return (
    <section id="for-you" aria-labelledby="for-you-heading" className="bg-background py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-secondary px-3 py-3 sm:px-5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2
                id="for-you-heading"
                className="flex min-w-0 items-center gap-1.5 text-base font-extrabold tracking-tight text-foreground sm:text-xl"
              >
                <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate">Rekomendasi Untukmu</span>
              </h2>
              <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                {personalised
                  ? "Dipilih dari kategori yang baru kamu lihat"
                  : "Mulai jelajahi produk — rekomendasi akan menyesuaikan seleramu"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {personalised && (
                <button
                  type="button"
                  onClick={clearViewHistory}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
              <a
                href="#products"
                className="flex items-center gap-0.5 text-[11px] font-semibold text-primary transition-opacity hover:opacity-80 sm:text-sm"
              >
                See all
                <ChevronRight className="h-4 w-4 shrink-0" />
              </a>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto p-3 [scrollbar-width:none] sm:p-4 [&::-webkit-scrollbar]:hidden">
            {picks.map(({ product, reason }) => (
              <Link
                key={product.id}
                to="/products/$id"
                params={{ id: product.id }}
                className="group flex w-[144px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] sm:w-[176px]"
              >
                <div className="aspect-square overflow-hidden bg-secondary">
                  <img
                    src={overrides?.[product.id]?.[0] ?? product.images[0]}
                    alt={product.title}
                    loading="lazy"
                    width={400}
                    height={400}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <span className="inline-flex min-w-0 items-center gap-1 self-start rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <History className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{reason}</span>
                  </span>
                  <h3 className="line-clamp-2 text-xs font-medium text-foreground">
                    {product.title}
                  </h3>
                  <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="h-3 w-3 shrink-0 fill-current text-warning" />
                    <span className="font-semibold text-foreground">{product.rating}</span>
                    <span className="truncate">({product.reviews})</span>
                  </div>
                  <p className="mt-auto text-sm font-extrabold text-foreground">{product.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
