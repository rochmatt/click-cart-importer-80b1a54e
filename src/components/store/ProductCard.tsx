import { useState } from "react";
import { ArrowRight, Eye, Heart, Star, Flame, AlertCircle, Package, ShoppingCart, Check } from "lucide-react";
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
  const [justAdded, setJustAdded] = useState(false);
  const cover = useCoverImage(product.id, product.images);
  const bestseller = isBestseller(product);
  const lowStock = isLowStock(product);
  const outOfStock = isOutOfStock(product);

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
      1,
    );

    setJustAdded(true);
    toast.success("Ditambahkan ke keranjang", {
      description: product.title,
      duration: 1500,
    });
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article className="group relative">
      <Link
        to="/products/$id"
        params={{ id: product.id }}
        className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary sm:max-h-52 lg:max-h-48">
          <img
            src={cover}
            alt={product.title}
            loading="lazy"
            width={800}
            height={600}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {product.oldPrice && (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold text-destructive-foreground">
              SALE
            </span>
          )}

          <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5">
            {bestseller && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-warning-foreground shadow-sm">
                <Flame className="h-3 w-3" />
                Best Seller
              </span>
            )}
            {outOfStock && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground shadow-sm">
                <Package className="h-3 w-3" />
                Habis
              </span>
            )}
            {lowStock && !outOfStock && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground shadow-sm">
                <AlertCircle className="h-3 w-3" />
                Stok menipis
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3.5 sm:p-4">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {product.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-chart-4 text-chart-4" />
            <span className="font-semibold text-foreground">{product.rating}</span>
            <span>({product.reviews.toLocaleString()})</span>
          </div>

          <div className="mt-auto flex flex-wrap items-baseline gap-2">
            <span className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">
              {product.price}
            </span>
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {product.oldPrice}
              </span>
            )}
          </div>

          <div className="pt-1">
            <span className="relative inline-flex w-full items-center justify-center whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors group-hover:bg-primary/90">
              View Product
              <ArrowRight className="absolute right-3 h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        aria-label={`Add ${product.title} to wishlist`}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-all hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Heart className="h-4 w-4" />
      </button>

      {onQuickView && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickView(product);
          }}
          aria-label={`Quick view ${product.title}`}
          className="absolute inset-x-3 top-1/3 z-10 inline-flex items-center justify-center gap-2 rounded-full bg-background/95 px-4 py-2 text-xs font-semibold text-foreground opacity-0 shadow-sm backdrop-blur transition-all hover:bg-background focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Eye className="h-3.5 w-3.5" />
          Quick view
        </button>
      )}
    </article>
  );
}
