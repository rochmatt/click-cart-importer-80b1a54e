import { useSyncExternalStore } from "react";
import { me } from "@/lib/auth/auth.functions";

// Keadaan autentikasi sisi klien.
//
// BENTUK KEMBALIANNYA SENGAJA DIPERTAHANKAN: { loading, session, user }.
// Delapan belas berkas membacanya, dan mengubah bentuknya bersamaan dengan
// pergantian mesin autentikasi berarti dua hal gagal sekaligus tanpa bisa
// dibedakan penyebabnya.
//
// Bedanya dengan versi Supabase: tidak ada lagi sesi di localStorage yang bisa
// dibaca seketika. Identitas hanya diketahui server lewat cookie httpOnly,
// jadi keadaan awal SELALU loading sampai satu pemanggilan me() selesai.
//
// Store dipakai bersama, bukan state per komponen: kalau tiap pemakai useAuth
// memanggil me() sendiri, satu halaman bisa menembakkan belasan permintaan dan
// menampilkan keadaan berbeda-beda di saat bersamaan.

export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

export interface AuthState {
  loading: boolean;
  /** Dipertahankan demi pemanggil lama; kini hanya penanda ada/tidaknya sesi. */
  session: { user: AuthUser } | null;
  user: AuthUser | null;
}

const KOSONG: AuthState = { loading: true, session: null, user: null };

let keadaan: AuthState = KOSONG;
let sedangMuat: Promise<void> | null = null;
const pendengar = new Set<() => void>();

function umumkan() {
  for (const l of pendengar) l();
}

function setKeadaan(user: AuthUser | null) {
  keadaan = { loading: false, session: user ? { user } : null, user };
  umumkan();
}

/**
 * Mengambil ulang identitas dari server.
 *
 * Pemanggilan yang tumpang tindih digabung menjadi satu: tanpa itu, halaman
 * dengan banyak komponen ber-useAuth akan menembakkan me() berkali-kali pada
 * pemuatan pertama.
 */
export function refreshAuth(): Promise<void> {
  sedangMuat ??= me()
    .then((user) => setKeadaan((user as AuthUser | null) ?? null))
    .catch(() => setKeadaan(null))
    .finally(() => {
      sedangMuat = null;
    });
  return sedangMuat;
}

/** Dipanggil setelah masuk atau keluar supaya seluruh komponen ikut berubah. */
export function setAuthUser(user: AuthUser | null): void {
  setKeadaan(user);
}

function subscribe(l: () => void): () => void {
  pendengar.add(l);
  // Pengambilan pertama ditunda sampai ada yang benar-benar mendengarkan,
  // sehingga halaman tanpa komponen auth tidak memanggil server sama sekali.
  if (keadaan.loading && !sedangMuat) void refreshAuth();
  return () => {
    pendengar.delete(l);
  };
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => keadaan,
    // Saat render di server keadaannya selalu loading: cookie tidak dibaca di
    // sini, dan menebak "belum login" akan membuat tampilan berkedip dari tamu
    // ke pengguna setelah hidrasi.
    () => KOSONG,
  );
}

export function displayNameFor(user: AuthUser | null): string {
  if (!user) return "";
  return user.email?.split("@")[0] ?? "Shopper";
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "U";
}
