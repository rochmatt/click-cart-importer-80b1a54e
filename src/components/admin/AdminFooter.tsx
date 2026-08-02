import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";

/** Footer khusus panel admin — ringkas, tidak memakai footer storefront. */
export function AdminFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">PasarPilih</span>
          <span>· Admin console · © {year}</span>
        </p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link to="/admin/settings" className="transition-colors hover:text-foreground">
            Pengaturan
          </Link>
          <Link to="/admin/analytics" className="transition-colors hover:text-foreground">
            Analitik
          </Link>
          <Link to="/" className="transition-colors hover:text-foreground">
            Lihat storefront
          </Link>
        </nav>
      </div>
    </footer>
  );
}
