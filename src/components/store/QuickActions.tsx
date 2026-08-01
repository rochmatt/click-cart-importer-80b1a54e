import {
  Truck,
  Ticket,
  BadgeCheck,
  Smartphone,
  Sparkles,
  Shirt,
  Home,
  Gamepad2,
  Gift,
  PackageSearch,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

const actions = [
  { label: "Track Order", icon: PackageSearch, tone: "text-primary bg-primary/10", to: "/track" },
  { label: "Free Shipping", icon: Truck, tone: "text-primary bg-primary/10" },
  { label: "Vouchers", icon: Ticket, tone: "text-[var(--flash)] bg-[var(--flash)]/10" },
  { label: "Official Store", icon: BadgeCheck, tone: "text-tokopedia bg-tokopedia/10" },
  { label: "For You", icon: Sparkles, tone: "text-primary bg-primary/10" },
  { label: "Gadgets", icon: Smartphone, tone: "text-primary bg-primary/10" },
  { label: "Beauty", icon: Sparkles, tone: "text-chart-5 bg-chart-5/10" },
  { label: "Fashion", icon: Shirt, tone: "text-chart-4 bg-chart-4/15" },
  { label: "Home", icon: Home, tone: "text-tokopedia bg-tokopedia/10" },
  { label: "Gaming", icon: Gamepad2, tone: "text-chart-3 bg-chart-3/10" },
  { label: "Rewards", icon: Gift, tone: "text-[var(--flash)] bg-[var(--flash)]/10" },
] as { label: string; icon: typeof Truck; tone: string; to?: string }[];

export function QuickActions() {
  return (
    <section aria-label="Quick actions" className="bg-background py-4">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-5">
          <div className="grid auto-cols-[minmax(4.5rem,1fr)] grid-flow-col grid-rows-2 gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid-flow-row sm:grid-cols-5 sm:overflow-visible lg:grid-cols-10 lg:grid-rows-1 [&::-webkit-scrollbar]:hidden">
            {actions.map(({ label, icon: Icon, tone, to }) => {
              const Comp = to ? Link : "button";
              return (
              <Comp
                key={label}
                {...(to ? { to } : { type: "button" as const })}
                className="group flex flex-col items-center gap-2 rounded-xl p-1 text-center transition-colors hover:bg-secondary"
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-full transition-transform group-hover:scale-110 ${tone}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="w-full truncate text-[11px] font-medium leading-tight text-foreground">
                  {label}
                </span>
              </Comp>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
