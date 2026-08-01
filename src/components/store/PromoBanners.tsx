import { ArrowRight } from "lucide-react";
import promo1 from "@/assets/promo1.jpg";
import promo2 from "@/assets/promo2.jpg";
import promo3 from "@/assets/promo3.jpg";

const banners = [
  { image: promo1, title: "Beauty Fest", sub: "Buy 1 get 1 on skincare" },
  { image: promo2, title: "Home Makeover", sub: "Up to 40% off decor" },
  { image: promo3, title: "Sneaker Drop", sub: "New arrivals every Friday" },
];

export function PromoBanners() {
  return (
    <section aria-label="Promotions" className="bg-background py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {banners.map((b, i) => (
            <a
              key={b.title}
              href="#products"
              className={`group relative overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] ${
                i === 2 ? "col-span-2 lg:col-span-1" : ""
              }`}
            >
              <img
                src={b.image}
                alt=""
                aria-hidden="true"
                loading="lazy"
                width={800}
                height={600}
                className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-40"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <p className="text-sm font-bold text-background sm:text-base">{b.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-background/80 sm:text-xs">
                  {b.sub}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
