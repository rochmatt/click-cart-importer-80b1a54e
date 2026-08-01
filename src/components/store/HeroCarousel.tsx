import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import banner1 from "@/assets/banner1.jpg";
import banner2 from "@/assets/banner2.jpg";
import banner3 from "@/assets/banner3.jpg";

const slides = [
  {
    image: banner1,
    eyebrow: "Mega Sale 9.9",
    title: "Up to 70% off\nacross every category",
    subtitle: "Thousands of deals refreshed daily. Grab yours before they sell out.",
    cta: "Explore Products",
    href: "#products",
  },
  {
    image: banner2,
    eyebrow: "Gadget Week",
    title: "Tech deals that\nactually feel unfair",
    subtitle: "Audio, wearables and smartphones with extra vouchers applied at checkout.",
    cta: "Shop Gadgets",
    href: "#for-you",
  },
  {
    image: banner3,
    eyebrow: "Free Shipping",
    title: "Free delivery\nall over Indonesia",
    subtitle: "No minimum spend on selected official stores this week only.",
    cta: "Claim Voucher",
    href: "#products",
  },
];

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((next: number) => {
    setIndex((next + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((v) => (v + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <section
      aria-label="Promotional banners"
      className="bg-secondary py-3 sm:py-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="group relative overflow-hidden rounded-2xl shadow-[var(--shadow-card-hover)] sm:rounded-3xl">
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((s, i) => (
              <div key={s.eyebrow} className="relative w-full shrink-0">
                <img
                  src={s.image}
                  alt=""
                  aria-hidden="true"
                  width={1600}
                  height={700}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="h-[190px] w-full object-cover sm:h-[300px] lg:h-[380px]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-foreground/85 via-foreground/50 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-center gap-2 p-5 sm:gap-3 sm:p-10 lg:p-14">
                  <span className="w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground sm:text-xs" style={{ backgroundImage: "var(--gradient-flash)" }}>
                    {s.eyebrow}
                  </span>
                  <h2 className="max-w-md whitespace-pre-line text-xl font-extrabold leading-tight tracking-tight text-background sm:text-3xl lg:text-4xl">
                    {s.title}
                  </h2>
                  <p className="hidden max-w-sm text-sm text-background/80 sm:block">
                    {s.subtitle}
                  </p>
                  <a
                    href={s.href}
                    className="mt-1 inline-flex h-9 w-fit items-center rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 sm:h-11 sm:px-7 sm:text-sm"
                  >
                    {s.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => go(index - 1)}
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground shadow-sm transition-all hover:bg-background sm:grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => go(index + 1)}
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground shadow-sm transition-all hover:bg-background sm:grid"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.eyebrow}
                type="button"
                aria-label={`Go to banner ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-background" : "w-1.5 bg-background/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
