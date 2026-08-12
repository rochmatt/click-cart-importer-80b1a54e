import { createFileRoute } from "@tanstack/react-router";
import {
  exchangeCodeForTokens,
  fetchGoogleProfile,
  findOrCreateGoogleUser,
  googleConfig,
  googleRedirectUri,
  originFromRequest,
} from "@/lib/auth/google-oauth.server";
import { createSessionToken, sessionCookieHeader } from "@/lib/auth/session.server";

const STATE_COOKIE = "g_oauth_state";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

const clearState = `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/** Redirect balik ke halaman akun sambil membuang cookie state. */
function fail(origin: string, reason: string): Response {
  const headers = new Headers({ Location: `${origin}/account?authError=${reason}` });
  headers.append("Set-Cookie", clearState);
  return new Response(null, { status: 302, headers });
}

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = originFromRequest(request);
        const url = new URL(request.url);

        // Google memantulkan ?error bila user membatalkan di layar consent.
        if (url.searchParams.get("error")) return fail(origin, "google_dibatalkan");

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookieState = readCookie(request.headers.get("cookie"), STATE_COOKIE);
        // State harus ada di keduanya dan cocok (anti-CSRF / anti replay).
        if (!code || !state || !cookieState || state !== cookieState) {
          return fail(origin, "google_state");
        }

        const cfg = await googleConfig();
        if (!cfg) return fail(origin, "google_belum_disetel");

        let email: string | undefined;
        try {
          const tokens = await exchangeCodeForTokens(code, cfg, googleRedirectUri(origin));
          const profile = await fetchGoogleProfile(tokens.access_token);
          if (profile.email_verified === false)
            return fail(origin, "google_email_belum_terverifikasi");
          email = profile.email;
        } catch {
          return fail(origin, "google_gagal");
        }
        if (!email) return fail(origin, "google_tanpa_email");

        const userId = await findOrCreateGoogleUser(email);
        const token = await createSessionToken(userId);

        // Set cookie sesi MANUAL di Response (setCookie() tak melekat ke Response
        // yang dibangun sendiri di route handler), lalu buang cookie state.
        const headers = new Headers({ Location: `${origin}/` });
        headers.append("Set-Cookie", sessionCookieHeader(token));
        headers.append("Set-Cookie", clearState);
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
