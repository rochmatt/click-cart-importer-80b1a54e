// Verifikasi signature Standard Webhooks (https://www.standardwebhooks.com),
// skema yang dipakai Supabase Auth Hook.
//
// Ditulis manual dengan node:crypto, bukan memakai paket `standardwebhooks`,
// supaya tidak menambah dependency untuk ~40 baris HMAC.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Toleransi selisih jam antara Supabase dan server ini. */
const TOLERANCE_SECONDS = 5 * 60;

export class WebhookVerifyError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WebhookVerifyError";
    this.status = status;
  }
}

/**
 * Secret dari dashboard Supabase berbentuk `v1,whsec_<base64>`. Yang dipakai
 * sebagai kunci HMAC adalah hasil base64-decode dari bagian setelah prefix.
 */
function decodeSecret(secret: string): Buffer {
  const raw = secret
    .trim()
    .replace(/^v1,/, "")
    .replace(/^whsec_/, "");
  return Buffer.from(raw, "base64");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual melempar kalau panjangnya beda, jadi disaring lebih dulu.
  // Panjang signature base64 selalu sama, sehingga ini tidak membocorkan apa pun.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Melempar WebhookVerifyError kalau request tidak sah. Body harus berupa teks
 * mentah — sekali di-JSON.parse lalu di-stringify ulang, signature tidak cocok
 * lagi karena urutan dan spasi bisa berubah.
 */
export function verifyStandardWebhook(options: {
  body: string;
  headers: Headers;
  secret: string;
  /** Detik epoch; diinjeksi pada test. */
  now?: number;
}): void {
  const { body, headers, secret } = options;

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");

  if (!id || !timestamp || !signatureHeader) {
    throw new WebhookVerifyError(401, "Missing webhook signature headers");
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    throw new WebhookVerifyError(401, "Invalid webhook timestamp");
  }

  // Tanpa cek ini, signature yang pernah bocor bisa diputar ulang selamanya.
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - sentAt) > TOLERANCE_SECONDS) {
    throw new WebhookVerifyError(401, "Webhook timestamp outside tolerance window");
  }

  const expected = createHmac("sha256", decodeSecret(secret))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // Header boleh memuat beberapa signature dipisah spasi (saat rotasi secret).
  // Cukup satu yang cocok.
  const matched = signatureHeader
    .split(" ")
    .map((entry) => entry.split(",", 2))
    .some(
      ([version, signature]) => version === "v1" && signature && safeEqual(signature, expected),
    );

  if (!matched) {
    throw new WebhookVerifyError(401, "Webhook signature mismatch");
  }
}
