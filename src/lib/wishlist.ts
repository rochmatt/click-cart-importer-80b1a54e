import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { getMyWishlist, replaceMyWishlist } from "@/lib/basket.functions";

export interface WishlistItem {
  id: string;
  title: string;
  price: string;
  image: string;
}

const STORAGE_KEY = "pasarpilih.wishlist";

let items: WishlistItem[] = [];
let hydrated = false;
let userId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed as WishlistItem[];
    }
  } catch {
    /* ignore corrupt storage */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

async function pushToServer() {
  if (!userId) return;
  const uid = userId;
  const snapshot = items;
  try {
    // user_id tidak lagi dikirim dari sini — server menurunkannya dari JWT.
    void uid;
    await replaceMyWishlist({ data: snapshot });
  } catch {
    /* transient — local storage keeps the list */
  }
}

function setItems(next: WishlistItem[], { sync = true } = {}) {
  items = next;
  persist();
  emit();
  if (sync) void pushToServer();
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: WishlistItem[] = [];

export function useWishlist() {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
}

async function adoptServerWishlist(uid: string) {
  hydrate();
  userId = uid;
  let data;
  try {
    data = await getMyWishlist();
  } catch {
    return;
  }

  const merged = new Map<string, WishlistItem>();
  for (const row of data ?? []) {
    merged.set(row.product_ref, {
      id: row.product_ref,
      title: row.title,
      image: row.image,
      price: row.price,
    });
  }
  for (const local of items) if (!merged.has(local.id)) merged.set(local.id, local);
  setItems([...merged.values()]);
}

/** Keeps the wishlist in sync with the current session. Mount once (header). */
export function useWishlistSync() {
  // Identitas kini datang dari store auth bersama, bukan dari pendengar
  // Supabase. Efek ini berjalan ulang setiap user berubah, jadi masuk dan
  // keluar tetap tertangani tanpa langganan terpisah.
  const { user } = useAuth();
  useEffect(() => {
    let active = true;
    const uid = user?.id ?? null;

    if (!uid) {
      userId = null;
      setItems([], { sync: false });
      return;
    }
    if (uid !== userId) void adoptServerWishlist(uid);

    return () => {
      active = false;
      void active;
    };
  }, [user]);
}

export function isWishlisted(list: WishlistItem[], id: string) {
  return list.some((i) => i.id === id);
}

/** Adds or removes the product. Returns true when it ends up saved. */
export function toggleWishlist(item: WishlistItem): boolean {
  hydrate();
  if (items.some((i) => i.id === item.id)) {
    setItems(items.filter((i) => i.id !== item.id));
    return false;
  }
  setItems([...items, item]);
  return true;
}

export function removeFromWishlist(id: string) {
  hydrate();
  setItems(items.filter((i) => i.id !== id));
}
