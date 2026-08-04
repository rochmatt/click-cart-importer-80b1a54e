import { Link } from "@tanstack/react-router";
import { Check, ShoppingCart, Zap } from "lucide-react";

/**
 * Floating purchase bar for phones on the product detail page. It replaces the
 * generic bottom navigation there so the primary actions stay thumb-reachable.
 */
export function ProductStickyActions({
  productId,
  onAddToCart,
  added,
  disabled,
}: {
  productId: string;
  onAddToCart: () => void;
  /** True sesaat setelah item ditambahkan; menukar ikon jadi centang. */
  added?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      {/* keeps page content clear of the fixed bar */}
      <div aria-hidden="true" className="h-20 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-3 pb-3 pt-2.5 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onAddToCart}
            disabled={disabled}
            aria-label={added ? "Added to cart" : "Add to cart"}
            className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
              added
                ? "border-success bg-success/10 text-success"
                : "border-primary text-primary hover:bg-accent"
            }`}
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {added ? "Added" : "Add to Cart"}
          </button>
          <Link
            to="/checkout"
            search={{ product: productId, qty: 1 }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-brand)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Zap className="h-4 w-4" />
            Buy Now
          </Link>
        </div>
      </div>
    </>
  );
}
