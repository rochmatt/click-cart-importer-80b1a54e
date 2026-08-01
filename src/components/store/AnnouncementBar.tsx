import { useEffect, useState } from "react";
import { Smartphone, Truck, BadgePercent } from "lucide-react";

const messages = [
  { icon: Smartphone, text: "Download the app & get 50% OFF your first order" },
  { icon: Truck, text: "Free shipping all over Indonesia — no minimum spend" },
  { icon: BadgePercent, text: "New user vouchers up to Rp100.000 — claim now" },
];

export function AnnouncementBar() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % messages.length), 4000);
    return () => clearInterval(t);
  }, []);

  const { icon: Icon, text } = messages[i];

  return (
    <div className="text-primary-foreground" style={{ backgroundImage: "var(--gradient-flash)" }}>
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-2 px-4 text-center">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <p key={i} className="animate-in fade-in slide-in-from-bottom-1 truncate text-[11px] font-semibold tracking-tight sm:text-xs">
          {text}
        </p>
      </div>
    </div>
  );
}
