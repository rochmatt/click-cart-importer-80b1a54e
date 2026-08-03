import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Menaikkan skema request dari http ke https saat proxy di depan menyatakannya.
 *
 * KENAPA PERLU: nginx menerminasi TLS lalu meneruskan ke Node lewat HTTP biasa,
 * jadi request.url selalu berskema http. Apa pun yang menurunkan URL publik dari
 * request.url ikut salah — redirect, URL kanonik, dan tautan absolut akan menunjuk
 * http://, yang memicu satu lompatan tidak terenkripsi sebelum HSTS membetulkannya.
 * Diperbaiki sekali di sini, sebelum request menyentuh handler mana pun.
 *
 * KENAPA DIGERBANGI ENV: memercayai X-Forwarded-Proto hanya aman kalau proxy di
 * depan MENIMPA header itu, bukan meneruskan apa pun dari klien. nginx di server
 * ini melakukannya (proxy_set_header X-Forwarded-Proto $scheme). Di lingkungan
 * lain belum tentu, jadi default-nya mati — tanpa TRUST_PROXY_PROTO=1 fungsi ini
 * tidak melakukan apa-apa.
 */
function applyForwardedProto(request: Request): Request {
  if (process.env.TRUST_PROXY_PROTO !== "1") return request;

  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded !== "https") return request;

  const url = new URL(request.url);
  if (url.protocol === "https:") return request;
  url.protocol = "https:";

  // Request diteruskan sebagai init, bukan disebar dengan spread: properti
  // Request ada di prototype sebagai getter, jadi spread tidak menyalin apa pun
  // dan method/header/body akan hilang. Konstruktor Request menangani bentuk ini
  // secara khusus, termasuk body-nya.
  return new Request(url.href, request);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(applyForwardedProto(request), env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
