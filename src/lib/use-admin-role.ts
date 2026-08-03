import { useEffect, useState } from "react";
import { amIAdmin } from "@/lib/basket.functions";
import { useAuth } from "@/lib/auth";

export interface AdminRoleState {
  loading: boolean;
  isAdmin: boolean;
  signedIn: boolean;
}

/**
 * Checks whether the signed-in user has the `admin` role.
 * Mirrors the database RLS rules that guard product writes.
 */
export function useAdminRole(): AdminRoleState {
  const { loading: authLoading, user } = useAuth();
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean }>({
    loading: true,
    isAdmin: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, isAdmin: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    // Peran ditentukan server dari JWT, bukan dibaca browser dari user_roles.
    // Kegagalan diperlakukan sebagai bukan-admin: gagal ke arah menolak akses.
    amIAdmin()
      .then((isAdmin) => {
        if (!cancelled) setState({ loading: false, isAdmin });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, isAdmin: false });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  return {
    loading: authLoading || state.loading,
    isAdmin: state.isAdmin,
    signedIn: Boolean(user),
  };
}
