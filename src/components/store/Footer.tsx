import { Facebook, Instagram, ShoppingBag, Twitter, Youtube } from "lucide-react";
import { Link } from "@tanstack/react-router";

const socials = [
  { label: "Instagram", icon: Instagram },
  { label: "Twitter", icon: Twitter },
  { label: "Facebook", icon: Facebook },
  { label: "YouTube", icon: Youtube },
];

const companyLinks = [
  { label: "About Us", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "How it works", to: "/how-it-works" },
];

const supportLinks = [
  { label: "Track Order", to: "/track" },
  { label: "FAQ", to: "/faq" },
];

const legalLinks = [
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms of Service", to: "/terms-of-service" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Pasar<span className="text-primary">Pilih</span>
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            A curated shopping platform operated by PT RAFA KPT. We sell selected
            products directly and help you compare deals across trusted
            marketplaces.
          </p>
          <div className="mt-5 flex gap-2">
            {socials.map(({ label, icon: Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <nav aria-label="Company">
          <h3 className="text-sm font-semibold text-foreground">Company</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {companyLinks.map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="transition-colors hover:text-primary">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Support">
          <h3 className="text-sm font-semibold text-foreground">Support</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {supportLinks.map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="transition-colors hover:text-primary">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h3 className="text-sm font-semibold text-foreground">Legal</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {legalLinks.map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="transition-colors hover:text-primary">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
          © {new Date().getFullYear()} PT RAFA KPT (PasarPilih). Prices and
          availability on partner marketplaces are set by the destination
          marketplace.
        </p>
      </div>
    </footer>
  );
}
