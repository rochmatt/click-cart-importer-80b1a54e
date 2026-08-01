import {
  BadgeCheck,
  MapPin,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";

const perks = [
  {
    icon: Truck,
    title: "Free shipping",
    detail: "Orders above Rp 300.000 · arrives in 2–4 days",
  },
  {
    icon: RotateCcw,
    title: "7-day easy returns",
    detail: "Free pickup if the item arrives damaged",
  },
  {
    icon: ShieldCheck,
    title: "1-year official warranty",
    detail: "Covered by the authorised local distributor",
  },
  {
    icon: PackageCheck,
    title: "100% authentic",
    detail: "Money back if the product is not genuine",
  },
];

export function ProductAssurance() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
            <Store className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
              PasarPilih Official
              <BadgeCheck className="h-4 w-4 text-primary" />
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              Jakarta Pusat · Ships within 24 hours
            </p>
          </div>
        </div>
        <span className="ml-auto rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
          In stock
        </span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {perks.map((perk) => (
          <li key={perk.title} className="flex items-start gap-2.5">
            <perk.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="leading-tight">
              <p className="text-sm font-medium text-foreground">{perk.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{perk.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
