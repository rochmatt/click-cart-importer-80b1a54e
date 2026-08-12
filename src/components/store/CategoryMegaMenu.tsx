import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Dumbbell,
  Baby,
  Gamepad2,
  Utensils,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import { products } from "@/data/products";
import { categorySlug } from "@/data/categories";

type Category = {
  label: string;
  icon: typeof Shirt;
  groups: { title: string; links: string[] }[];
  featured: string[];
};

const categories: Category[] = [
  {
    label: "Fashion",
    icon: Shirt,
    groups: [
      { title: "Men", links: ["Sneakers", "T-shirts", "Jackets", "Watches"] },
      { title: "Women", links: ["Dresses", "Handbags", "Heels", "Jewelry"] },
      { title: "Accessories", links: ["Belts", "Sunglasses", "Caps", "Wallets"] },
    ],
    featured: ["1", "2"],
  },
  {
    label: "Electronics",
    icon: Smartphone,
    groups: [
      { title: "Mobile", links: ["Smartphones", "Cases", "Chargers", "Power banks"] },
      { title: "Audio", links: ["Earbuds", "Headphones", "Speakers", "Microphones"] },
      { title: "Computing", links: ["Laptops", "Keyboards", "Monitors", "Storage"] },
    ],
    featured: ["3", "4"],
  },
  {
    label: "Home & Living",
    icon: Sofa,
    groups: [
      { title: "Furniture", links: ["Sofas", "Desks", "Chairs", "Shelving"] },
      { title: "Decor", links: ["Lighting", "Rugs", "Wall art", "Plants"] },
      { title: "Storage", links: ["Boxes", "Organizers", "Racks", "Hangers"] },
    ],
    featured: ["5", "6"],
  },
  {
    label: "Beauty",
    icon: Sparkles,
    groups: [
      { title: "Skincare", links: ["Serums", "Moisturizers", "Sunscreen", "Masks"] },
      { title: "Makeup", links: ["Lipstick", "Foundation", "Mascara", "Palettes"] },
      { title: "Hair", links: ["Shampoo", "Styling", "Treatments", "Tools"] },
    ],
    featured: ["7", "8"],
  },
  {
    label: "Sports",
    icon: Dumbbell,
    groups: [
      { title: "Fitness", links: ["Dumbbells", "Yoga mats", "Resistance bands", "Trackers"] },
      { title: "Outdoor", links: ["Running", "Cycling", "Hiking", "Camping"] },
      { title: "Apparel", links: ["Training tops", "Shorts", "Shoes", "Socks"] },
    ],
    featured: ["2", "5"],
  },
  {
    label: "Kids",
    icon: Baby,
    groups: [
      { title: "Baby", links: ["Diapers", "Bottles", "Strollers", "Toys"] },
      { title: "Kids fashion", links: ["Tops", "Shoes", "Outerwear", "Backpacks"] },
      { title: "Learning", links: ["Books", "Puzzles", "STEM kits", "Art"] },
    ],
    featured: ["6", "3"],
  },
  {
    label: "Gaming",
    icon: Gamepad2,
    groups: [
      { title: "Consoles", links: ["Handhelds", "Controllers", "Accessories", "Games"] },
      { title: "PC gear", links: ["Mechanical keyboards", "Mice", "Headsets", "Chairs"] },
      { title: "Collectibles", links: ["Figures", "Card games", "Merch", "Posters"] },
    ],
    featured: ["4", "1"],
  },
  {
    label: "Kitchen",
    icon: Utensils,
    groups: [
      { title: "Cookware", links: ["Pans", "Pots", "Knives", "Cutting boards"] },
      { title: "Appliances", links: ["Air fryers", "Blenders", "Coffee makers", "Rice cookers"] },
      { title: "Dining", links: ["Plates", "Glassware", "Cutlery", "Lunch boxes"] },
    ],
    featured: ["8", "7"],
  },
];

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

interface CategoryMegaMenuProps {
  onQueryChange: (value: string) => void;
}

export function CategoryMegaMenu({ onQueryChange }: CategoryMegaMenuProps) {
  const baseId = useId();
  const navigate = useNavigate();
  const panelId = `${baseId}-panel`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // when true, move DOM focus to the active tab after render (keyboard flow only)
  const focusActiveTab = useRef(false);

  // Filter kategori di dalam mega menu (dari mock: input .mega-search). Cocok
  // bila label kategori ATAU salah satu subkategori mengandung kata kunci.
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return categories;
    return categories.filter(
      (c) =>
        c.label.toLowerCase().includes(t) ||
        c.groups.some((g) => g.links.some((l) => l.toLowerCase().includes(t))),
    );
  }, [q]);

  // activeIndex mengindeks `shown`; kembalikan ke 0 tiap kali hasil berubah.
  useEffect(() => setActiveIndex(0), [q]);

  const current = shown[activeIndex] ?? shown[0];
  const featured = (current?.featured ?? [])
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as typeof products;

  useEffect(() => {
    if (open && focusActiveTab.current) {
      focusActiveTab.current = false;
      tabRefs.current[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  const closeMenu = (returnFocus = false) => {
    setOpen(false);
    focusActiveTab.current = false;
    if (returnFocus) triggerRef.current?.focus();
  };

  const openWithKeyboard = (index = activeIndex) => {
    focusActiveTab.current = true;
    setActiveIndex(index);
    setOpen(true);
  };

  const pick = (term: string) => {
    onQueryChange(term);
    closeMenu(true);
    // always land on a page that can show results for the term
    navigate({ to: "/search", search: { q: term } });
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && event.key === "ArrowDown") {
        focusActiveTab.current = true;
        tabRefs.current[activeIndex]?.focus();
      } else if (open) {
        closeMenu();
      } else {
        openWithKeyboard(0);
      }
    }
  };

  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = shown.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;

    if (next !== null) {
      event.preventDefault();
      focusActiveTab.current = true;
      setActiveIndex(next);
      return;
    }

    if (event.key === "ArrowRight" && current) {
      event.preventDefault();
      const panelSelector = `#${CSS.escape(`${baseId}-tabpanel-${slug(current.label)}`)}`;
      const first = containerRef.current?.querySelector<HTMLElement>(
        `${panelSelector} a, ${panelSelector} button`,
      );
      first?.focus();
    }
  };

  const onContainerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      closeMenu(true);
    }
  };

  const onBlurCapture = (event: React.FocusEvent) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={onContainerKeyDown}
      onBlurCapture={onBlurCapture}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onKeyDown={onTriggerKeyDown}
        onClick={() => (open ? closeMenu() : openWithKeyboard(activeIndex))}
        className="inline-flex items-center gap-1.5 rounded-md font-medium text-header-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-header-background"
      >
        <LayoutGrid aria-hidden="true" className="h-4 w-4 text-primary" />
        Categories
      </button>

      <div
        id={panelId}
        hidden={!open}
        aria-label="Product categories"
        role="group"
        className="absolute left-0 top-full z-50 pt-2"
      >
        <div className="w-[880px] overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <div className="border-b border-border p-2.5">
            <label htmlFor={`${baseId}-mega-filter`} className="sr-only">
              Saring daftar kategori
            </label>
            <input
              id={`${baseId}-mega-filter`}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Saring kategori (mis: Sepatu, Tas)…"
              aria-label="Saring daftar kategori"
              autoComplete="off"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="grid grid-cols-[210px_1fr_260px]">
            <div
              role="tablist"
              aria-orientation="vertical"
              aria-label="Category groups"
              className="border-r border-border bg-secondary/40 py-2"
            >
              {shown.map(({ label, icon: Icon }, index) => {
                const selected = index === activeIndex;
                return (
                  <button
                    key={label}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${slug(label)}`}
                    aria-selected={selected}
                    aria-controls={`${baseId}-tabpanel-${slug(label)}`}
                    tabIndex={selected ? 0 : -1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onKeyDown={(e) => onTabKeyDown(e, index)}
                    onClick={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                      selected
                        ? "bg-background font-semibold text-primary"
                        : "text-foreground hover:text-primary"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    <span className="flex-1 truncate">{label}</span>
                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 opacity-60" />
                  </button>
                );
              })}
              <Link
                to="/categories"
                onClick={() => closeMenu()}
                className="mt-2 flex items-center gap-1.5 border-t border-border px-4 pb-1 pt-3 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                Lihat semua kategori
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>

            {current ? (
              <>
                <div
                  role="tabpanel"
                  id={`${baseId}-tabpanel-${slug(current.label)}`}
                  aria-labelledby={`${baseId}-tab-${slug(current.label)}`}
                  tabIndex={-1}
                  className="p-5"
                >
                  <Link
                    to="/category/$slug"
                    params={{ slug: categorySlug(current.label) }}
                    onClick={() => closeMenu()}
                    className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Shop all {current.label}
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                  <div className="grid grid-cols-3 gap-4">
                    {current.groups.map((group) => (
                      <nav key={group.title} aria-label={`${current.label} — ${group.title}`}>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.title}
                        </h3>
                        <ul className="space-y-1.5">
                          {group.links.map((link) => (
                            <li key={link}>
                              <button
                                type="button"
                                onClick={() => pick(link)}
                                className="rounded text-sm text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {link}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    ))}
                  </div>
                </div>

                <div className="border-l border-border bg-secondary/30 p-4">
                  <h3
                    id={`${baseId}-featured`}
                    className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Featured in {current.label}
                  </h3>
                  <ul aria-labelledby={`${baseId}-featured`} className="space-y-3">
                    {featured.map((product) => (
                      <li key={product.id}>
                        <Link
                          to="/products/$id"
                          params={{ id: product.id }}
                          onClick={() => closeMenu()}
                          className="flex gap-3 rounded-xl bg-background p-2 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <img
                            src={product.images[0]}
                            alt=""
                            loading="lazy"
                            className="h-14 w-14 shrink-0 rounded-lg object-cover"
                          />
                          <span className="min-w-0">
                            <span className="line-clamp-2 block text-xs font-medium text-foreground">
                              {product.title}
                            </span>
                            <span className="mt-1 block text-xs font-semibold text-primary">
                              {product.price}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="col-span-2 grid place-items-center p-10 text-center text-sm text-muted-foreground">
                Tidak ada kategori yang cocok.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
