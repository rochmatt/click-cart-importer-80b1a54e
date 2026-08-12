import { useEffect, useState } from "react";
import { amIAdmin } from "@/lib/basket.functions";
import { useAuth } from "@/lib/auth";

export interface AdminRoleState {
  loading: boolean;
  isAdmin: boolean;
  signedIn: boolean;
}

// Cache per-sesi hasil amIAdmin() per user id. Header storefront dipasang
// per-rute, jadi tanpa ini tiap navigasi memicu satu panggilan server untuk
// tiap user yang login. `pending` men-dedupe panggilan yang sedang berjalan;
// `settled` menyimpan boolean final agar mount berikutnya bisa merender SINKRON
// (tanpa kedip saat admin bernavigasi). HANYA sukses yang di-cache — kegagalan
// dihapus supaya percobaan berikutnya mengulang (fail-closed per percobaan).
// Basi hanya sampai reload; server tetap otoritatif via assertAdmin. Gerbang
// nyata /admin memakai { fresh: true } agar pencabutan peran langsung terlihat.
const pending = new Map<string, Promise<boolean>>();
const settled = new Map<string, boolean>();

function fetchIsAdmin(userId: string): Promise<boolean> {
  const cached = pending.get(userId);
  if (cached) return cached;
  const p = amIAdmin();
  pending.set(userId, p);
  p.then((v) => settled.set(userId, v)).catch(() => pending.delete(userId));
  return p;
}

export interface UseAdminRoleOptions {
  /**
   * Lewati cache sesi dan tanya server tiap mount. Dipakai gerbang /admin
   * (AdminGuard) supaya pencabutan peran langsung terlihat saat masuk lagi,
   * sementara tautan kosmetik "Panel admin" di header cukup pakai cache.
   */
  fresh?: boolean;
}

/**
 * Checks whether the signed-in user has the `admin` role.
 * Mirrors the database RLS rules that guard product writes.
 */
export function useAdminRole(options?: UseAdminRoleOptions): AdminRoleState {
  const fresh = options?.fresh ?? false;
  const { loading: authLoading, user } = useAuth();

  // Seed sinkron dari hasil yang sudah settle (mode cache saja) agar tautan admin
  // langsung tampil pada frame pertama saat remount — tanpa kedip/geser tata letak.
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean }>(() =>
    !fresh && user && settled.has(user.id)
      ? { loading: false, isAdmin: settled.get(user.id)! }
      : { loading: true, isAdmin: false },
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, isAdmin: false });
      return;
    }

    // Mode cache: kalau hasil sudah settle, pakai langsung tanpa refetch.
    if (!fresh && settled.has(user.id)) {
      setState({ loading: false, isAdmin: settled.get(user.id)! });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    // Peran ditentukan server dari sesi, bukan dibaca browser dari user_roles.
    // Kegagalan diperlakukan sebagai bukan-admin: gagal ke arah menolak akses.
    const promise = fresh
      ? amIAdmin().then((v) => {
          // Perbarui cache agar tautan kosmetik ikut menyusul nilai terbaru.
          settled.set(user.id, v);
          return v;
        })
      : fetchIsAdmin(user.id);

    promise
      .then((isAdmin) => {
        if (!cancelled) setState({ loading: false, isAdmin });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, isAdmin: false });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, fresh]);

  return {
    loading: authLoading || state.loading,
    isAdmin: state.isAdmin,
    signedIn: Boolean(user),
  };
}
