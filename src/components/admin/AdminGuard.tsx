import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useAdminRole } from "@/lib/use-admin-role";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { loading, isAdmin, signedIn } = useAdminRole();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAdmin) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Admin access only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {signedIn
            ? "Your account does not have the admin role, so products cannot be created, edited, or removed."
            : "Sign in with an admin account to manage the product catalog."}
        </p>
        <Link
          to={signedIn ? "/" : "/account"}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {signedIn ? "Back to store" : "Go to sign in"}
        </Link>
      </div>
    </div>
  );
}
