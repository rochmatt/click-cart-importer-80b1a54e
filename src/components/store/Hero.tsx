import { ArrowRight, ShieldCheck } from "lucide-react";
import heroImage from "@/assets/hero.jpg";

export function Hero() {
  return (
    <section className="border-b border-border bg-secondary">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-20">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compare prices across marketplaces
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            One catalog. <br />
            Every marketplace.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Discover hand-picked products in one place, then check out on Shopee,
            Tokopedia, or TikTok Shop — whichever gives you the better deal.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#products"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-brand)] transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Explore Products
              <ArrowRight className="h-4 w-4" />
            </a>
            <div className="text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">12,400+</strong>{" "}
              products tracked
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-3xl border border-border bg-background shadow-[var(--shadow-card-hover)]">
            <img
              src={heroImage}
              alt="Assorted lifestyle products including sneakers, headphones and sunglasses"
              width={1600}
              height={1100}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
