import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { categoryCatalog } from "@/data/categories";

export interface ProductFilterState {
  categories: string[];
  priceRange: [number, number];
  minRating: number | null;
}

interface ProductFiltersProps {
  value: ProductFilterState;
  onChange: (value: ProductFilterState) => void;
  maxPrice: number;
}

const ratings = [
  { value: 4, label: "4★ & up" },
  { value: 3, label: "3★ & up" },
  { value: 2, label: "2★ & up" },
];

function formatPrice(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function FilterContent({ value, onChange, maxPrice }: ProductFiltersProps) {
  const toggleCategory = (label: string) => {
    const next = value.categories.includes(label)
      ? value.categories.filter((c) => c !== label)
      : [...value.categories, label];
    onChange({ ...value, categories: next });
  };

  const activeCount = value.categories.length + (value.minRating ? 1 : 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() =>
              onChange({ categories: [], priceRange: [0, maxPrice], minRating: null })
            }
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Category
        </h4>
        <div className="flex flex-wrap gap-2">
          {categoryCatalog.map((c) => {
            const active = value.categories.includes(c.label);
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggleCategory(c.label)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                {active && <X className="h-3 w-3" />}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Price Range
          </h4>
          <span className="text-xs font-medium text-foreground">
            {formatPrice(value.priceRange[0])} - {formatPrice(value.priceRange[1])}
          </span>
        </div>
        <Slider
          value={value.priceRange}
          min={0}
          max={maxPrice}
          step={50000}
          onValueChange={(v) =>
            onChange({ ...value, priceRange: [v[0], v[1]] })
          }
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{formatPrice(0)}</span>
          <span>{formatPrice(maxPrice)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Minimum Rating
        </h4>
        <div className="flex flex-wrap gap-2">
          {ratings.map((r) => {
            const active = value.minRating === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    minRating: value.minRating === r.value ? null : r.value,
                  })
                }
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-chart-4 bg-chart-4 text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-chart-4/40 hover:text-chart-4"
                }`}
              >
                <Star className="h-3 w-3 fill-current" />
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ProductFilters({ value, onChange, maxPrice }: ProductFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProductFilterState>(value);

  // Keep the sheet's draft in sync whenever it is (re)opened.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const draftDirty =
    JSON.stringify(draft) !== JSON.stringify(value);


  const activeCount = useMemo(
    () => value.categories.length + (value.minRating ? 1 : 0),
    [value]
  );

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full border-border bg-background text-foreground hover:bg-secondary"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-[320px] flex-col gap-0 sm:w-[380px]"
          >
            <SheetHeader className="mb-6 text-left">
              <SheetTitle className="text-lg">Filter products</SheetTitle>
            </SheetHeader>
            <div className="-mx-1 flex-1 overflow-y-auto px-1 pb-4">
              <FilterContent value={draft} onChange={setDraft} maxPrice={maxPrice} />
            </div>
            <div className="mt-auto flex items-center gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-full"
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                Apply filters{draftDirty ? " •" : ""}
              </Button>
            </div>
          </SheetContent>

        </Sheet>

        <div className="hidden flex-1 items-center gap-3 lg:flex">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {categoryCatalog.map((c) => {
              const active = value.categories.includes(c.label);
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? value.categories.filter((cat) => cat !== c.label)
                      : [...value.categories, c.label];
                    onChange({ ...value, categories: next });
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 border-l border-border pl-3">
            <div className="w-36">
              <Slider
                value={value.priceRange}
                min={0}
                max={maxPrice}
                step={50000}
                onValueChange={(v) =>
                  onChange({ ...value, priceRange: [v[0], v[1]] })
                }
              />
            </div>
            <span className="whitespace-nowrap text-xs font-medium text-foreground">
              {formatPrice(value.priceRange[0])} - {formatPrice(value.priceRange[1])}
            </span>

            {ratings.map((r) => {
              const active = value.minRating === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      minRating: active ? null : r.value,
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-chart-4 bg-chart-4 text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-chart-4/40 hover:text-chart-4"
                  }`}
                >
                  <Star className="h-3 w-3 fill-current" />
                  {r.value}★+
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {value.categories.map((cat) => (
            <Badge
              key={cat}
              variant="secondary"
              className="cursor-pointer gap-1 pr-2 text-xs"
              onClick={() =>
                onChange({
                  ...value,
                  categories: value.categories.filter((c) => c !== cat),
                })
              }
            >
              {cat}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {value.minRating && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 pr-2 text-xs"
              onClick={() => onChange({ ...value, minRating: null })}
            >
              {value.minRating}★ & up
              <X className="h-3 w-3" />
            </Badge>
          )}
          <button
            type="button"
            onClick={() =>
              onChange({ categories: [], priceRange: [0, maxPrice], minRating: null })
            }
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
