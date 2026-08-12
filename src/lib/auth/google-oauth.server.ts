// Login "Lanjutkan dengan Google" — OAuth 2.0 Authorization Code flow.
//
// Alur: tombol → /api/auth/google/start (set cookie state + redirect ke Google)
// → Google → /api/auth/google/callback (tukar code jadi token, ambil profil,
// cari/buat user, buat sesi). Client secret HANYA dipakai server saat menukar
// code; tidak pernah menyentuh browser.
//
// AKTIVASI: butuh kredensial dari Google Cloud Console (hanya pemilik yang bisa
// membuatnya). Isi lewat panel Admin → Settings (tersimpan di store_settings),
// ATAU sebagai fallback GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET di
// .env.server.local. Daftarkan redirect URI `<origin>/api/auth/google/callback`
// di client OAuth. Tanpa kredensial, googleConfig() mengembalikan null dan alur
// menolak dengan pesan yang jelas alih-alih rusak.

import { randomBytes } from "node:crypto";
import { run } from "@/lib/db/pool.server";

const OWNER = { rls: false } as const;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Kredensial OAuth, atau null bila belum diset. Prioritas: kolom di
 * store_settings (diisi lewat panel Admin) lebih dulu, lalu environment sebagai
 * fallback. Sengaja dibaca sebagai PASANGAN penuh dari satu sumber — tidak
 * mencampur clientId DB dengan secret env (bisa menghasilkan pasangan tak cocok).
 * Dibaca lewat run(..., {rls:false}) server-side; secret tak pernah ke browser.
 */
export async function googleConfig(): Promise<GoogleConfig | null> {
  let dbId = "";
  let dbSecret = "";
  try {
    const rows = await run<{ google_client_id: string; google_client_secret: string }>(
      "SELECT google_client_id, google_client_secret FROM public.store_settings ORDER BY created_at ASC LIMIT 1",
      [],
      OWNER,
    );
    dbId = rows[0]?.google_client_id?.trim() ?? "";
    dbSecret = rows[0]?.google_client_secret?.trim() ?? "";
  } catch {
    // Kalau tabel/kolom belum ada (mis. saat migrasi), jatuh ke env di bawah.
  }
  if (dbId && dbSecret) return { clientId: dbId, clientSecret: dbSecret };

  const envId = process.env.GOOGLE_CLIENT_ID?.trim();
  const envSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };

  return null;
}

/** Origin absolut dari header proxy (Cloudflare/nginx) atau URL request. */
export function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

/** URI callback yang HARUS didaftarkan di Google Cloud Console. */
export function googleRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function newOAuthState(): string {
  return randomBytes(16).toString("hex");
}

export function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokens {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
}

export async function exchangeCodeForTokens(
  code: string,
  cfg: GoogleConfig,
  redirectUri: string,
): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange gagal: ${res.status}`);
  return (await res.json()) as GoogleTokens;
}

export interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Ambil profil dari userinfo endpoint dengan access token. Dipercaya karena
 * diambil langsung server→Google lewat HTTPS (tak lewat browser).
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo gagal: ${res.status}`);
  return (await res.json()) as GoogleProfile;
}

/**
 * Cari user by email (case-insensitive) atau buat baru tanpa password
 * (encrypted_password NULL). Email Google sudah terverifikasi → email_confirmed_at
 * langsung diisi. Kalau email cocok akun yang sudah ada, keduanya "tertaut" (login
 * Google memakai akun yang sama — orang yang sama, sebab Google memverifikasi
 * kepemilikan email). Mengembalikan id user.
 */
export async function findOrCreateGoogleUser(email: string): Promise<string> {
  const existing = await run<{ id: string }>(
    "SELECT id FROM auth.users WHERE lower(email) = lower($1)",
    [email],
    OWNER,
  );
  if (existing[0]) {
    await run(
      "UPDATE auth.users SET email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() WHERE id = $1",
      [existing[0].id],
      OWNER,
    );
    return existing[0].id;
  }
  const created = await run<{ id: string }>(
    "INSERT INTO auth.users (email, email_confirmed_at) VALUES ($1, now()) RETURNING id",
    [email],
    OWNER,
  );
  return created[0]!.id;
}
