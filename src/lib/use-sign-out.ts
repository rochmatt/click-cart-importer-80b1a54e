import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { signOut } from "@/lib/auth/auth.functions";
import { setAuthUser } from "@/lib/auth";

/**
 * Sign-out terpusat untuk SEMUA pintu keluar (header akun, menu storefront,
 * panel akun). Mengembalikan satu fungsi async; argumennya adalah pesan toast
 * sukses (opsional).
 *
 * KENAPA HOOK, BUKAN SALIN-TEMPEL: `signOut` di sini adalah server function
 * yang diimpor. Tiap kali alur ini disalin ke dalam sebuah komponen, muncul
 * godaan menamai fungsi lokalnya `signOut` juga — nama itu MEMBAYANGI impor,
 * `await signOut()` lalu memanggil dirinya sendiri (rekursi tak henti → browser
 * freeze, tak pernah benar-benar logout). Dengan satu-satunya impor `signOut`
 * dikurung di sini, footgun itu lenyap: pemanggil cuma menerima fungsi tanpa
 * nama yang bisa bertabrakan.
 *
 * Urutan langkah penting: batalkan query berjalan lalu kosongkan cache SEBELUM
 * sesi dihapus, supaya tidak ada refetch yang memakai identitas yang sudah
 * mati; baru setelah server melepas sesi, state auth klien dinolkan.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(
    async (successMessage = "Signed out") => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut();
      setAuthUser(null);
      toast.success(successMessage);
      navigate({ to: "/", replace: true });
    },
    [navigate, queryClient],
  );
}
