import { useCallback, useSyncExternalStore } from "react";
import { CATEGORY_GROUPS, categoryKey } from "@/lib/admin-store";

const STORAGE_KEY = "pasarpilih:category-groups";

export const GROUP_NAMES = CATEGORY_GROUPS.map((g) => g.group) as string[];

/** Built-in group for a category name, if it ships with the catalog. */
export function builtinGroup(category: string): string | null {
  const key = categoryKey(category);
  const found = CATEGORY_GROUPS.find((g) =>
    (g.items as readonly string[]).some((i) => categoryKey(i) === key),
  );
  return found ? found.group : null;
}

type Overrides = Record<string, string>;

let cache: Overrides = {};
let loaded = false;
const listeners = new Set<() => void>();

function read(): Overrides {
  if (loaded) return cache;
  loaded = true;
  if (typeof window === "undefined") return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Overrides) {
  cache = next;
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: Overrides = {};

/** Admin-selected group mappings for category names. */
export function useCategoryOverrides() {
  const overrides = useSyncExternalStore(
    subscribe,
    () => read(),
    () => EMPTY,
  );

  const setGroup = useCallback((category: string, group: string) => {
    write({ ...read(), [categoryKey(category)]: group });
  }, []);

  const renameCategory = useCallback((from: string, to: string, group: string) => {
    const next = { ...read() };
    delete next[categoryKey(from)];
    next[categoryKey(to)] = group;
    write(next);
  }, []);

  const groupOf = useCallback(
    (category: string) => overrides[categoryKey(category)] ?? builtinGroup(category),
    [overrides],
  );

  return { overrides, setGroup, renameCategory, groupOf };
}
