import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ChatFab } from "@/components/store/ChatFab";
import { cn } from "@/lib/utils";

const pages = [
  { to: "/about", label: "About" },
  { to: "/how-it-works", label: "Cara kerja" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Kontak" },
  { to: "/privacy-policy", label: "Privasi" },
  { to: "/terms-of-service", label: "Ketentuan" },
] as const;

type LegalPageLayoutProps = {
  heading: string;
  lead?: ReactNode;
  children: ReactNode;
};

export function LegalPageLayout({ heading, lead, children }: LegalPageLayoutProps) {
  const [query, setQuery] = useState("");
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8 lg:pb-20 lg:pt-14">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Kembali berbelanja
        </Link>

        <header className="mt-1">
          <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
            {heading}
          </h1>
          {lead ? (
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              {lead}
            </p>
          ) : null}
        </header>

        <nav
          aria-label="Halaman informasi"
          className="-mx-4 mt-6 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {pages.map((p) => {
              const active = pathname === p.to;
              return (
                <li key={p.to}>
                  <Link
                    to={p.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {p.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="legal-content mt-8 space-y-6 text-[15px] leading-relaxed text-muted-foreground sm:text-base [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:sm:text-lg [&_a]:break-words [&_li]:leading-relaxed [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ol]:space-y-4">
          {children}
        </div>
      </main>

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}

export function LegalCallout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-10 rounded-2xl border border-border bg-secondary/50 p-5 sm:p-6">
      <p className="font-medium text-foreground">{title}</p>
      <div className="mt-1 text-sm leading-relaxed sm:text-[15px]">{children}</div>
    </div>
  );
}
