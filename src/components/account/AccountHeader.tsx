import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingBag,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

import { displayNameFor, initialsFor, useAuth } from "@/lib/auth";
import { useAdminRole } from "@/lib/use-admin-role";
import { useSignOut } from "@/lib/use-sign-out";

const TABS = [
  { label: "Profil", to: "/account", icon: UserRound },
  { label: "Pengaturan", to: "/profile", icon: SlidersHorizontal },
  { label: "Pesanan", to: "/track", icon: Package },
  { label: "Wishlist", to: "/wishlist", icon: ShoppingBag },
] as const;

/** Header khusus panel akun pengguna (bukan header storefront). */
export function AccountHeader() {
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const signOut = useSignOut();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const label = displayNameFor(user);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Kembali ke toko</span>
        </Link>

        <span className="ml-auto flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initialsFor(label)}
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-xs font-semibold leading-tight text-foreground">
              {label}
            </span>
            <span className="block truncate text-[11px] leading-tight text-muted-foreground">
              Panel akun
            </span>
          </span>
          {isAdmin && (
            <Link
              to="/admin"
              aria-label="Panel admin"
              className="ml-1 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/40 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Panel admin</span>
            </Link>
          )}
          <button
            type="button"
            aria-label="Keluar"
            onClick={() => void signOut("Kamu sudah keluar")}
            className="ml-1 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </span>
      </div>

      <div className="mx-auto max-w-5xl px-2 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const active = pathname === tab.to;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
