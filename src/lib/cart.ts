import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  id: string;
  title: string;
  price: string;
  image: string;
  qty: number;
}

const STORAGE_KEY = "pasarpilih.cart";

let items: CartItem[] = [];
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
      if (Array.isArray(parsed)) items = parsed as CartItem[];
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

/** Mirrors the cart to the signed-in shopper's account so it follows devices. */
async function pushToServer() {
  if (!userId) return;
  const uid = userId;
  const snapshot = items;
  try {
    await supabase.from("cart_items").delete().eq("user_id", uid);
    if (snapshot.length) {
      await supabase.from("cart_items").insert(
        snapshot.map((i) => ({
          user_id: uid,
          product_ref: i.id,
          title: i.title,
          image: i.image,
          price: i.price,
          qty: i.qty,
        })),
      );
    }
  } catch {
    /* offline / transient — local storage remains the source of truth */
  }
}

function setItems(next: CartItem[], { sync = true } = {}) {
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

const EMPTY: CartItem[] = [];

export function useCart() {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
}

/** Merges the guest cart with the account cart the first time a user signs in. */
async function adoptServerCart(uid: string) {
  hydrate();
  userId = uid;
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_ref, title, image, price, qty")
    .eq("user_id", uid);
  if (error) return;

  const merged = new Map<string, CartItem>();
  for (const row of data ?? []) {
    merged.set(row.product_ref, {
      id: row.product_ref,
      title: row.title,
      image: row.image,
      price: row.price,
      qty: row.qty,
    });
  }
  for (const local of items) {
    const existing = merged.get(local.id);
    merged.set(local.id, existing ? { ...existing, qty: Math.max(existing.qty, local.qty) } : local);
  }
  setItems([...merged.values()]);
}

/** Keeps the cart in sync with the current session. Mount once (header). */
export function useCartSync() {
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      if (!active || !uid) return;
      void adoptServerCart(uid);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const uid = session?.user?.id ?? null;
      if (event === "SIGNED_OUT") {
        userId = null;
        setItems([], { sync: false });
        return;
      }
      if (uid && uid !== userId) void adoptServerCart(uid);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
}

export function addToCart(item: Omit<CartItem, "qty">, qty = 1) {
  hydrate();
  const existing = items.find((i) => i.id === item.id);
  if (existing) {
    setItems(items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + qty } : i)));
  } else {
    setItems([...items, { ...item, qty }]);
  }
}

export function setCartQty(id: string, qty: number) {
  hydrate();
  if (qty <= 0) return removeFromCart(id);
  setItems(items.map((i) => (i.id === id ? { ...i, qty } : i)));
}

export function removeFromCart(id: string) {
  hydrate();
  setItems(items.filter((i) => i.id !== id));
}

export function clearCart() {
  setItems([]);
}

export function parsePrice(price: string) {
  const digits = price.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function formatIDR(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function cartCount(list: CartItem[]) {
  return list.reduce((sum, i) => sum + i.qty, 0);
}

export function cartSubtotal(list: CartItem[]) {
  return list.reduce((sum, i) => sum + parsePrice(i.price) * i.qty, 0);
}
