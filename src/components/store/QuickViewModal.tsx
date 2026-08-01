import { Link } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";
import type { Product } from "@/data/products";
import { useProductImages } from "@/lib/cover-overrides";
import { ProductImageCarousel } from "./ProductImageCarousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickViewModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickViewModal({ product, open, onOpenChange }: QuickViewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {product && <QuickViewBody product={product} />}
      </DialogContent>
    </Dialog>
  );
}

function QuickViewBody({ product }: { product: Product }) {
  // Admin-selected cover is always the first slide.
  const images = useProductImages(product.id, product.images);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ProductImageCarousel key={product.id} images={images} alt={product.title} />

      <div className="flex flex-col">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-extrabold leading-snug tracking-tight sm:text-xl">
            {product.title}
          </DialogTitle>
          <DialogDescription className="line-clamp-4 text-sm">
            {product.description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-chart-4 text-chart-4" />
          <span className="font-semibold text-foreground">{product.rating}</span>
          <span>({product.reviews.toLocaleString()} reviews)</span>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-foreground">
            {product.price}
          </span>
          {product.oldPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {product.oldPrice}
            </span>
          )}
        </div>

        {product.specs.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            {product.specs.slice(0, 4).map((spec) => (
              <li key={spec} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{spec}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/checkout"
            search={{ product: product.id, qty: 1 }}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Buy Now
          </Link>
          <Link
            to="/products/$id"
            params={{ id: product.id }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            View details
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
