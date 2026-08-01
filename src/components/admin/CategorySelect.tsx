import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { CATEGORY_GROUPS } from "@/lib/admin-store";

type Props = {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

/** Searchable, grouped category picker. */
export default function CategorySelect({ value, onChange, invalid = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORY_GROUPS.map((g) => ({
      group: g.group,
      items: g.items.filter((i) => !q || i.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        aria-invalid={invalid || undefined}
        className={`flex h-9 w-full items-center justify-between rounded-lg border bg-background px-3 text-left text-sm text-foreground outline-none transition-colors hover:border-primary/60 focus:border-primary ${
          invalid ? "border-destructive" : "border-border"
        }`}
      >
        <span className={value ? "" : "text-muted-foreground"}>
          {value || "Select a category"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-auto py-1">
            {groups.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">No categories found</li>
            )}
            {groups.map((g) => (
              <li key={g.group}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.group}
                </p>
                <ul>
                  {g.items.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={item === value}
                        onClick={() => {
                          onChange(item);
                          setOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      >
                        {item}
                        {item === value && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
