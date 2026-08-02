// Pengiriman email lewat HTTP API Resend.
//
// Server-only: membaca RESEND_API_KEY. JANGAN pernah di-import dari komponen
// client — key-nya akan ikut ke bundle browser.
//
// Menggantikan @lovable.dev/email-js. Dipakai fetch langsung, bukan SDK resend,
// supaya tidak menambah dependency: API-nya satu POST sederhana.

const DEFAULT_ENDPOINT = "https://api.resend.com/emails";

/**
 * Bisa diarahkan ke server tiruan lewat RESEND_ENDPOINT untuk memeriksa isi
 * email tanpa benar-benar mengirim. Menggantikan peran LOVABLE_SEND_URL dulu.
 */
function endpoint(): string {
  return process.env.RESEND_ENDPOINT || DEFAULT_ENDPOINT;
}

export class EmailSendError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Resend API error: ${status} ${body.slice(0, 500)}`);
    this.name = "EmailSendError";
    this.status = status;
    this.body = body;
  }

  /** 429 dan 5xx layak dicoba ulang; 4xx lainnya permanen (alamat salah, domain belum verified). */
  get retryable(): boolean {
    return this.status === 429 || (this.status >= 500 && this.status < 600);
  }
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Resend menolak kiriman ulang dengan key sama selama 24 jam. */
  idempotencyKey?: string;
  /** Override pengirim; default dari EMAIL_FROM. */
  from?: string;
}

/**
 * Alamat pengirim. Domain-nya harus sudah diverifikasi di Resend, kalau tidak
 * setiap kiriman ditolak 403.
 */
export function emailFrom(): string {
  return process.env.EMAIL_FROM || "PasarPilih <noreply@inipilihanku.com>";
}

/** Dipakai pemanggil untuk memutuskan degradasi anggun, bukan melempar error. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (input.idempotencyKey) {
    headers["Idempotency-Key"] = input.idempotencyKey;
  }

  const response = await fetch(endpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: input.from ?? emailFrom(),
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
    }),
  });

  if (!response.ok) {
    throw new EmailSendError(response.status, await response.text());
  }

  return (await response.json()) as { id: string };
}
