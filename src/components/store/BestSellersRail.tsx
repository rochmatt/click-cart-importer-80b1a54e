import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Award, Star } from "lucide-react";
import type { Product } from "@/data/products";
import { useImageOverrides } from "@/lib/cover-overrides";

/**
 * "Terlaris di Kategori Ini" — rail produk terlaris minggu ini, diurut jumlah
 * ulasan (proksi popularitas). Tiga teratas diberi lencana peringkat #1/#2/#3.
 *
 * Produk dilewatkan sebagai prop dari DiscoverFeed agar tidak memanggil useCatalog
 * dua kali; rail ikut tampil hanya setelah katalog termuat (top kosong → null).
 */
export function BestSellersRail({ products }: { products: Product[] }) {
  const { data: overrides } = useImageOverrides();

  const top = useMemo(
    () => [...products].sort((a, b) => b.reviews - a.reviews).slice(0, 8),
    [products],
  );

  if (top.length === 0) return null;

  return (
    <section
      aria-labelledby="bestseller-heading"
      className="mx-auto max-w-7xl px-3 pt-5 sm:px-6 lg:px-8"
    >
      <div className="rounded-2xl border border-border bg-card">
        <div className="px-4 pt-4 sm:px-5">
          <h2
            id="bestseller-heading"
            className="flex items-center gap-2 text-base font-extrabold tracking-tight text-foreground sm:text-lg"
          >
            <Award className="h-5 w-5 text-primary" aria-hidden="true" />
            Terlaris di Kategori Ini
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Produk paling populer dan banyak dicari minggu ini
          </p>
        </div>

        <div className="flex gap-3 overflow-x-auto p-3 [scrollbar-width:none] sm:p-4 [&::-webkit-scrollbar]:hidden">
          {top.map((product, i) => (
            <Link
              key={product.id}
              to="/products/$id"
              params={{ id: product.id }}
              className="group relative flex w-[144px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] sm:w-[176px]"
            >
              {i < 3 && (
                <span className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
                  #{i + 1} Terlaris
                </span>
              )}
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
                <span className="max-w-full self-start truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {product.category}
                </span>
                <h3 className="line-clamp-2 text-xs font-medium text-foreground">
                  {product.title}
                </h3>
                <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <Star className="h-3 w-3 shrink-0 fill-current text-warning" />
                  <span className="font-semibold text-foreground">{product.rating}</span>
                  <span className="truncate">({product.reviews})</span>
                </div>
                <div className="mt-auto flex items-baseline gap-1.5">
                  <span className="text-sm font-extrabold text-foreground">{product.price}</span>
                  {product.oldPrice && (
                    <span className="text-xs text-muted-foreground line-through">
                      {product.oldPrice}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
