import { useState } from "react";
import {
  ArrowRight,
  Eye,
  Heart,
  Star,
  Flame,
  AlertCircle,
  Package,
  ShoppingCart,
  Check,
  Plus,
  Minus,
  Tag,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Product } from "@/data/products";
import { useCoverImage } from "@/lib/cover-overrides";
import { addToCart } from "@/lib/cart";

const BESTSELLER_THRESHOLD = 1000;
const LOW_STOCK_THRESHOLD = 15;

function isBestseller(product: Product) {
  return (product.sold ?? 0) >= BESTSELLER_THRESHOLD;
}

function isLowStock(product: Product) {
  const stock = product.stock ?? 0;
  return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
}

function isOutOfStock(product: Product) {
  return (product.stock ?? 0) === 0;
}

export function ProductCard({
  product,
  onQuickView,
}: {
  product: Product;
  onQuickView?: (product: Product) => void;
}) {
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const cover = useCoverImage(product.id, product.images);
  const bestseller = isBestseller(product);
  const lowStock = isLowStock(product);
  const outOfStock = isOutOfStock(product);
  const maxQty = Math.max(1, product.stock ?? 0);

  const increaseQty = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQty((prev) => Math.min(prev + 1, maxQty));
  };

  const decreaseQty = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQty((prev) => Math.max(prev - 1, 1));
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;

    addToCart(
      {
        id: product.id,
        title: product.title,
        price: product.price,
        image: cover,
      },
      qty,
    );

    setJustAdded(true);
    toast.success("Ditambahkan ke keranjang", {
      description: `${qty} × ${product.title}`,
      duration: 1500,
    });
    setTimeout(() => {
      setJustAdded(false);
      setQty(1);
    }, 1200);
  };

  return (
    <article className="group relative">
      <Link
        to="/products/$id"
        params={{ id: product.id }}
        className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)]"
      >
        {/* Thumbnail stays clean — no overlays on the image. */}
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary sm:max-h-52 lg:max-h-48">
          <img
            src={cover}
            alt={product.title}
            loading="lazy"
            width={800}
            height={600}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-3.5 sm:p-4">
          {(product.oldPrice || bestseller || outOfStock || lowStock) && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {product.oldPrice && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground">
                  <Tag className="h-3 w-3 shrink-0" />
                  Sale
                </span>
              )}
              {bestseller && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-warning-foreground">
                  <Flame className="h-3 w-3 shrink-0" />
                  Best Seller
                </span>
              )}
              {outOfStock && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <Package className="h-3 w-3 shrink-0" />
                  Habis
                </span>
              )}
              {lowStock && !outOfStock && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Stok menipis
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <h3 className="line-clamp-2 min-w-0 text-sm font-medium leading-snug text-foreground">
              {product.title}
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              aria-label={`Add ${product.title} to wishlist`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Heart className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 shrink-0 fill-chart-4 text-chart-4" />
            <span className="font-semibold text-foreground">{product.rating}</span>
            <span className="truncate">({product.reviews.toLocaleString()})</span>
          </div>

          <div className="mt-auto flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">
              {product.price}
            </span>
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {product.oldPrice}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 items-center gap-2 pt-1 min-[420px]:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[auto_minmax(0,1fr)]">

            <div
              className={`flex items-center gap-0.5 rounded-full bg-primary p-1 text-primary-foreground transition-all ${outOfStock ? "opacity-70" : "hover:bg-primary/90"}`}
            >
              <button
                type="button"
                onClick={decreaseQty}
                disabled={outOfStock || qty <= 1}
                aria-label="Kurangi jumlah"
                className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-primary-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={outOfStock}
                aria-label={
                  outOfStock
                    ? "Stok habis"
                    : `Tambahkan ${qty} ${product.title} ke keranjang`
                }
                className="flex min-w-[3.25rem] items-center justify-center gap-1.5 px-2 text-sm font-bold transition-colors disabled:cursor-not-allowed"
              >
                <span className="w-4 text-center">{qty}</span>
                {justAdded ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <ShoppingCart className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={increaseQty}
                disabled={outOfStock || qty >= maxQty}
                aria-label="Tambah jumlah"
                className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-primary-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {onQuickView ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickView(product);
                }}
                aria-label={`Quick view ${product.title}`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Eye className="h-3.5 w-3.5" />
                Quick view
              </button>
            ) : (
              <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                View Product
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
