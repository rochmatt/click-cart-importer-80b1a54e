import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowUp,
  BadgeCheck,
  Bitcoin,
  CreditCard,
  Facebook,
  Instagram,
  Landmark,
  Lock,
  Mail,
  PackageCheck,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Truck,
  Twitter,
  Youtube,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const assurances = [
  {
    icon: ShieldCheck,
    title: "Pembayaran Aman",
    description: "Enkripsi & gateway terpercaya",
  },
  {
    icon: Truck,
    title: "Pengiriman Cepat",
    description: "Gratis ongkir tersedia",
  },
  {
    icon: PackageCheck,
    title: "7 Hari Retur",
    description: "Jaminan produk sesuai",
  },
  {
    icon: ShoppingBag,
    title: "Partner Resmi",
    description: "Shopee, Tokopedia, TikTok",
  },
];

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    setVisible(window.scrollY > 300);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label="Kembali ke atas"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-36 right-4 z-40 h-10 w-10 shrink-0 rounded-full shadow-lg transition-all duration-300 sm:bottom-20 sm:right-6",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none",
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Masukkan email yang valid");
      return;
    }
    const existing = JSON.parse(localStorage.getItem("pp_newsletter") || "[]");
    if (existing.includes(email)) {
      toast.info("Email ini sudah terdaftar");
      return;
    }
    localStorage.setItem("pp_newsletter", JSON.stringify([...existing, email]));
    toast.success("Berhasil berlangganan info & promo");
    setEmail("");
  };

  return (
    <div className="max-w-sm">
      <h3 className="text-sm font-semibold text-foreground">Dapatkan promo & info</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Langganan email untuk voucher eksklusif dan update produk terbaru.
      </p>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder="email@anda.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 pl-9"
            required
            aria-label="Alamat email untuk berlangganan promo"
          />
        </div>
        <Button type="submit" className="h-10 px-4">
          Daftar
        </Button>
      </form>
    </div>
  );
}

function AssuranceBar() {
  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {assurances.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:h-11 sm:w-11" aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const paymentMethods = [
  { label: "QRIS", icon: QrCode },
  { label: "Virtual Account", icon: Landmark },
  { label: "E-Wallet", icon: Smartphone },
  { label: "Kartu Kredit", icon: CreditCard },
  { label: "Crypto", icon: Bitcoin },
];

const securityBadges = [
  { label: "SSL Secure", icon: Lock },
  { label: "Verified", icon: BadgeCheck },
  { label: "Protected", icon: ShieldCheck },
];

function PaymentAndSecurity() {
  return (
    <div className="border-b border-border bg-secondary/30">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Metode Pembayaran
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Metode pembayaran">
            {paymentMethods.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground sm:min-h-10 sm:px-2.5 sm:py-1.5"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                <span className="whitespace-nowrap">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Keamanan &amp; Verifikasi
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Keamanan dan verifikasi">
            {securityBadges.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground sm:min-h-10 sm:px-2.5 sm:py-1.5"
              >
                <Icon className="h-4 w-4 shrink-0 text-success sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                <span className="whitespace-nowrap">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary">
      <AssuranceBar />

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
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
          <div className="mt-5 flex flex-wrap gap-2">
            {socials.map(({ label, icon: Icon }) => (
              <Button
                key={label}
                asChild
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full sm:h-10 sm:w-10"
                aria-label={`Kunjungi ${label} PasarPilih`}
              >
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            ))}
          </div>
        </div>

        <nav aria-label="Company">
          <h3 className="text-sm font-semibold text-foreground">Company</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {companyLinks.map(({ label, to }) => (
              <li key={label}>
                <Link
                  to={to}
                  className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
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
                <Link
                  to={to}
                  className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Newsletter />
      </div>

      <PaymentAndSecurity />

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            © {new Date().getFullYear()} PT RAFA KPT (PasarPilih). Prices and
            availability on partner marketplaces are set by the destination
            marketplace.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground sm:justify-start">
            {legalLinks.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <BackToTop />
    </footer>
  );
}
