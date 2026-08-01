import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, Home, Search, ShoppingBag, User } from "lucide-react";
import { useCart, useCartSync } from "@/lib/cart";
import { useWishlist, useWishlistSync } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

type Item = {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: number;
};

/**
 * Thumb-reachable navigation for phones. Hidden from `md:` upwards where the
 * full header navigation is visible.
 */
export function MobileBottomNav() {
  useCartSync();
  useWishlistSync();
  const cart = useCart();
  const wishlist = useWishlist();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const cartCount = cart.reduce((sum, line) => sum + (line.quantity ?? 1), 0);

  const items: Item[] = [
    { to: "/", label: "Home", icon: Home },
    { to: "/search", label: "Search", icon: Search },
    { to: "/wishlist", label: "Wishlist", icon: Heart, badge: wishlist.length },
    { to: "/checkout", label: "Cart", icon: ShoppingBag, badge: cartCount },
    { to: "/account", label: "Account", icon: User },
  ];

  return (
    <>
      {/* keeps page content clear of the fixed bar */}
      <div aria-hidden="true" className="h-16 md:hidden" />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-5">
          {items.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to} className="min-w-0">
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {item.badge ? (
                      <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
