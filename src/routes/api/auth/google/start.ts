import { createFileRoute } from "@tanstack/react-router";
import {
  buildGoogleAuthUrl,
  googleConfig,
  googleRedirectUri,
  newOAuthState,
  originFromRequest,
} from "@/lib/auth/google-oauth.server";

// Mulai OAuth Google: set cookie state (anti-CSRF) lalu redirect ke Google.
const STATE_COOKIE = "g_oauth_state";

export const Route = createFileRoute("/api/auth/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = originFromRequest(request);
        const cfg = await googleConfig();
        if (!cfg) {
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/account?authError=google_belum_disetel` },
          });
        }

        const state = newOAuthState();
        const url = buildGoogleAuthUrl(cfg.clientId, googleRedirectUri(origin), state);

        const headers = new Headers({ Location: url });
        // SameSite=Lax: cookie tetap terkirim pada navigasi top-level GET balik
        // dari google.com ke callback kita. httpOnly + Secure. Umur 10 menit.
        headers.append(
          "Set-Cookie",
          `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        );
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
