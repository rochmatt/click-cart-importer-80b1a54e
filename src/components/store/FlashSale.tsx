import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Zap, ChevronRight } from "lucide-react";
import { products } from "@/data/products";
import { useImageOverrides } from "@/lib/cover-overrides";

function parseRp(v: string) {
  return Number(v.replace(/[^0-9]/g, ""));
}

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const SALE_LENGTH = 2 * 60 * 60 + 15 * 60 + 30; // 02:15:30

const deals = products.slice(0, 6).map((p, i) => {
  const discount = [50, 35, 60, 45, 30, 55][i];
  const base = parseRp(p.oldPrice ?? p.price);
  return {
    product: p,
    discount,
    dealPrice: formatRp(Math.round((base * (100 - discount)) / 100 / 1000) * 1000),
    basePrice: formatRp(base),
    sold: [82, 64, 91, 40, 75, 55][i],
  };
});

function TimeBox({ value }: { value: number }) {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-xs font-bold tabular-nums text-background sm:h-8 sm:w-8 sm:text-sm">
      {String(value).padStart(2, "0")}
    </span>
  );
}

export function FlashSale() {
  const [left, setLeft] = useState(SALE_LENGTH);
  const { data: overrides } = useImageOverrides();


  useEffect(() => {
    const t = setInterval(() => setLeft((v) => (v <= 1 ? SALE_LENGTH : v - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const { h, m, s } = useMemo(
    () => ({
      h: Math.floor(left / 3600),
      m: Math.floor((left % 3600) / 60),
      s: left % 60,
    }),
    [left],
  );

  return (
    <section id="flash-sale" aria-labelledby="flash-heading" className="bg-background py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-5" style={{ backgroundImage: "var(--gradient-flash)" }}>
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <h2
                id="flash-heading"
                className="flex shrink-0 items-center gap-1.5 text-base font-extrabold uppercase tracking-tight text-primary-foreground sm:text-xl"
              >
                <Zap className="h-5 w-5 fill-current" />
                Flash Sale
              </h2>
              <div className="flex items-center gap-1">
                <TimeBox value={h} />
                <span className="text-sm font-bold text-primary-foreground">:</span>
                <TimeBox value={m} />
                <span className="text-sm font-bold text-primary-foreground">:</span>
                <TimeBox value={s} />
              </div>
            </div>
            <a
              href="#products"
              className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-primary-foreground/90 transition-colors hover:text-primary-foreground sm:text-sm"
            >
              See all
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="flex gap-3 overflow-x-auto p-3 [scrollbar-width:none] sm:p-4 [&::-webkit-scrollbar]:hidden">
            {deals.map(({ product, discount, dealPrice, basePrice, sold }) => (
              <Link
                key={product.id}
                to="/products/$id"
                params={{ id: product.id }}
                className="group w-[144px] shrink-0 overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-[var(--flash)]/40 hover:shadow-[var(--shadow-card-hover)] sm:w-[176px]"
              >
                <div className="relative aspect-square overflow-hidden bg-secondary">
                  <img
                    src={overrides?.[product.id]?.[0] ?? product.images[0]}
                    alt={product.title}
                    loading="lazy"
                    width={400}
                    height={400}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-0 top-2 rounded-r-full px-2 py-0.5 text-[11px] font-extrabold text-primary-foreground" style={{ backgroundImage: "var(--gradient-flash)" }}>
                    -{discount}%
                  </span>
                </div>
                <div className="p-2.5">
                  <h3 className="line-clamp-1 text-xs font-medium text-foreground">
                    {product.title}
                  </h3>
                  <p className="mt-1 text-sm font-extrabold text-[var(--flash)]">{dealPrice}</p>
                  <p className="text-[11px] text-muted-foreground line-through">{basePrice}</p>
                  <div className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${sold}%`, backgroundImage: "var(--gradient-flash)" }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                    {sold >= 80 ? "Almost sold out" : `${sold}% sold`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
