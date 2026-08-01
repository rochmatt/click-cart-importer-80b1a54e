import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  cartCount,
  cartSubtotal,
  formatIDR,
  removeFromCart,
  setCartQty,
  useCart,
} from "@/lib/cart";

export function CartMenu() {
  const items = useCart();
  const count = cartCount(items);
  const subtotal = cartSubtotal(items);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
          className="relative grid h-10 w-10 place-items-center rounded-full text-header-muted transition-colors hover:bg-header-foreground/10 hover:text-primary"
        >
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            My cart {count > 0 && <span className="text-muted-foreground">({count})</span>}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium text-foreground">Your cart is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse products and add your favourites here.
            </p>
          </div>
        ) : (
          <>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3 px-4 py-3">
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/products/$id"
                      params={{ id: item.id }}
                      className="line-clamp-2 text-xs font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 text-sm font-semibold text-primary">{item.price}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => setCartQty(item.id, item.qty - 1)}
                          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold">{item.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => setCartQty(item.id, item.qty + 1)}
                          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${item.title}`}
                        onClick={() => removeFromCart(item.id)}
                        className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-border px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold text-foreground">{formatIDR(subtotal)}</span>
              </div>
              <Link
                to="/checkout"
                search={{ product: undefined, qty: 1 }}

                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Checkout
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
