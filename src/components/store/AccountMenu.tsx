import { Link } from "@tanstack/react-router";
import {
  Heart,
  HelpCircle,
  LayoutDashboard,
  LogIn,
  LogOut,
  Package,
  Settings,
  Truck,
  User,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayNameFor, initialsFor, useAuth } from "@/lib/auth";
import { useWishlist } from "@/lib/wishlist";
import { useHoverMenu } from "@/lib/use-hover-menu";
import { useAdminRole } from "@/lib/use-admin-role";
import { useSignOut } from "@/lib/use-sign-out";

export function AccountMenu() {
  const { loading, user } = useAuth();
  const name = displayNameFor(user);
  const wishlist = useWishlist();
  const { open, setOpen, triggerHoverProps, contentHoverProps } = useHoverMenu();
  const { isAdmin } = useAdminRole();
  const signOut = useSignOut();

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={user ? `Account: ${name}` : "Account"}
          {...triggerHoverProps}
          className="grid h-10 w-10 place-items-center rounded-full text-header-muted transition-colors hover:bg-header-foreground/10 hover:text-primary data-[state=open]:bg-header-foreground/10 data-[state=open]:text-primary"
        >
          {user ? (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initialsFor(name)}
            </span>
          ) : (
            <User className="h-5 w-5" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[min(16rem,calc(100vw-2rem))] p-0"
        {...contentHoverProps}
      >
        <div className="space-y-2 border-b border-border px-4 py-3">
          {user ? (
            <>
              <p className="truncate text-sm font-semibold text-foreground">Hi, {name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Welcome to PasarPilih</p>
              <p className="text-xs text-muted-foreground">
                Sign in to see your orders and vouchers.
              </p>
              {!loading && (
                <div className="flex gap-2 pt-1">
                  <Link
                    to="/account"
                    search={{ mode: "signin" as const }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Sign in
                  </Link>
                  <Link
                    to="/account"
                    search={{ mode: "register" as const }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-primary px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Register
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        <div className="py-1">
          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            My account
          </DropdownMenuLabel>

          {isAdmin && (
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link
                to="/admin"
                className="flex items-center gap-2 text-sm font-semibold text-primary"
              >
                <LayoutDashboard className="h-4 w-4" />
                Panel admin
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/account" className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              My profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/account" hash="orders" className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              My orders
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/track" className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Track order
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/wishlist" className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Wishlist</span>
              {wishlist.length > 0 && (
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {wishlist.length > 99 ? "99+" : wishlist.length}
                </span>
              )}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/unsubscribe" className="flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Email settings
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {user ? (
            <DropdownMenuItem
              onSelect={() => void signOut()}
              className="cursor-pointer text-sm text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/track" className="flex items-center gap-2 text-sm">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                Help center
              </Link>
            </DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
