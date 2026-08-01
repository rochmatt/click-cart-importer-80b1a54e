import { Heart, Search, ShoppingBag, Truck, BadgeCheck, Ticket, Zap, HelpCircle, Store } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CartMenu } from "@/components/store/CartMenu";
import { AccountMenu } from "@/components/store/AccountMenu";
import { NotificationsMenu } from "@/components/store/NotificationsMenu";
import { CategoryMegaMenu } from "@/components/store/CategoryMegaMenu";
import { useCartSync } from "@/lib/cart";
import { useWishlist, useWishlistSync } from "@/lib/wishlist";

interface HeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
}

const trending = ["iphone 15", "sepatu lari", "skincare", "kopi susu", "mechanical keyboard"];

const navLinks = [
  { label: "Flash Sale", icon: Zap },
  { label: "Official Store", icon: BadgeCheck },
  { label: "Vouchers", icon: Ticket },
];

export function Header({ query, onQueryChange }: HeaderProps) {
  const navigate = useNavigate();
  useCartSync();
  useWishlistSync();
  const wishlist = useWishlist();


  const submitSearch = () => {
    const q = query.trim();
    navigate({ to: "/search", search: { q: q || undefined } });
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-header-muted/20 bg-header-background/90 text-header-foreground backdrop-blur-md">
        <div className="hidden border-b border-header-muted/15 lg:block">
          <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 text-xs text-header-muted sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5" /> Sell on PasarPilih
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" /> Free shipping nationwide
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/track" className="inline-flex items-center gap-1.5 transition-colors hover:text-primary">
                <Truck className="h-3.5 w-3.5" /> Track order
              </Link>
              <Link to="/unsubscribe" className="transition-colors hover:text-primary">
                Email settings
              </Link>
              <Link to="/track" className="inline-flex items-center gap-1.5 transition-colors hover:text-primary">
                <HelpCircle className="h-3.5 w-3.5" /> Help
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 lg:px-8">

          <a href="/" className="flex min-w-0 shrink-0 items-center gap-2 text-header-foreground">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="hidden text-lg font-extrabold tracking-tight sm:inline">
              Pasar<span className="text-primary">Pilih</span>
            </span>
          </a>

          <form
            className="min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            role="search"
          >
            <label htmlFor="site-search" className="sr-only">
              Search products
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-header-muted" />
              <input
                id="site-search"
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search products, brands, categories…"
                className="h-10 w-full rounded-full border border-header-foreground/20 bg-header-input pl-9 pr-4 text-sm text-header-foreground outline-none transition placeholder:text-header-muted focus:border-primary focus:bg-header-foreground/15 focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="mt-1.5 hidden items-center gap-2 text-[11px] text-header-muted lg:flex">
              <span className="font-medium">Trending:</span>
              {trending.map((t) => (
                <Link
                  key={t}
                  to="/search"
                  search={{ q: t }}
                  className="transition-colors hover:text-primary"
                >
                  {t}
                </Link>
              ))}
            </div>
          </form>


          <nav className="flex shrink-0 items-center gap-1">
            <Link
              to="/wishlist"
              aria-label={wishlist.length > 0 ? `Wishlist, ${wishlist.length} items` : "Wishlist"}
              className="relative grid h-10 w-10 place-items-center rounded-full text-header-muted transition-colors hover:bg-header-foreground/10 hover:text-primary"
            >
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
                  {wishlist.length > 99 ? "99+" : wishlist.length}
                </span>
              )}
            </Link>
            <NotificationsMenu />
            <CartMenu />
            <AccountMenu />
          </nav>
        </div>
      </header>

      <nav className="hidden border-b border-header-muted/15 bg-header-background lg:block">
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-5 px-4 text-sm sm:px-6 lg:px-8">
          <CategoryMegaMenu onQueryChange={onQueryChange} />
          <span className="h-4 w-px bg-header-muted/20" />
          {navLinks.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => onQueryChange("")}
              className="inline-flex items-center gap-1.5 font-medium text-header-foreground transition-colors hover:text-primary"
            >
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-header-muted">
            Compare prices across marketplaces
          </span>
        </div>
      </nav>
    </>
  );
}
