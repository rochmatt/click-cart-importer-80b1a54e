import {
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Dumbbell,
  Baby,
  Gamepad2,
  Utensils,
} from "lucide-react";
import { useState } from "react";

const categories = [
  { label: "Fashion", icon: Shirt },
  { label: "Electronics", icon: Smartphone },
  { label: "Home & Living", icon: Sofa },
  { label: "Beauty", icon: Sparkles },
  { label: "Sports", icon: Dumbbell },
  { label: "Kids", icon: Baby },
  { label: "Gaming", icon: Gamepad2 },
  { label: "Kitchen", icon: Utensils },
];

export function Categories() {
  const [active, setActive] = useState("Fashion");

  return (
    <section aria-labelledby="categories-heading" className="bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          id="categories-heading"
          className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Browse categories
        </h2>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {categories.map(({ label, icon: Icon }) => {
            const isActive = active === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setActive(label)}
                aria-pressed={isActive}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-brand)]"
                    : "border-border bg-secondary text-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
