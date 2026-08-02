import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

/** Footer khusus panel akun pengguna — ringkas, tanpa kolom storefront. */
export function AccountFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">PasarPilih</span>
          <span>· Panel akun · © {year}</span>
        </p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link to="/faq" className="transition-colors hover:text-foreground">
            Bantuan
          </Link>
          <Link to="/contact" className="transition-colors hover:text-foreground">
            Hubungi kami
          </Link>
          <Link to="/privacy-policy" className="transition-colors hover:text-foreground">
            Privasi
          </Link>
          <Link to="/unsubscribe" className="transition-colors hover:text-foreground">
            Notifikasi email
          </Link>
        </nav>
      </div>
    </footer>
  );
}
