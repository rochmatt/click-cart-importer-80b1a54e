import { useEffect, useState } from "react";

const KEY = "pasarpilih.recently-viewed";
const MAX = 12;
const EVENT = "pasarpilih:recently-viewed";

export interface ViewedEntry {
  id: string;
  category: string;
  at: number;
}

function read(): ViewedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ViewedEntry[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e) => e && typeof e.id === "string")
      : [];
  } catch {
    return [];
  }
}

function write(entries: ViewedEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* storage full or blocked — history is non-critical */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Records a product view, newest first, de-duplicated by product id. */
export function recordView(id: string, category: string) {
  if (typeof window === "undefined" || !id) return;
  const next = [{ id, category, at: Date.now() }, ...read().filter((e) => e.id !== id)];
  write(next);
}

export function clearViewHistory() {
  if (typeof window === "undefined") return;
  write([]);
}

/**
 * Browsing history for the current device. Reads after hydration so SSR and
 * the first client render agree.
 */
export function useRecentlyViewed(): ViewedEntry[] {
  const [entries, setEntries] = useState<ViewedEntry[]>([]);

  useEffect(() => {
    const sync = () => setEntries(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return entries;
}
