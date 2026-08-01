import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function PlaceholderSection({
  title,
  description,
  icon: Icon,
  bullets,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: string[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-foreground">{title} is coming next</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          This section is scaffolded in the console shell. Planned capabilities:
        </p>
        <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-sm text-muted-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
              {b}
            </li>
          ))}
        </ul>
        <Link
          to="/admin/products"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
        >
          Go to products
        </Link>
      </div>
    </div>
  );
}
