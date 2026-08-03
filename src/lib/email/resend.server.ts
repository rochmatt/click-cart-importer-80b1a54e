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
  /** Label jenis email untuk halaman Log Email, mis. "verifikasi", "pesanan". */
  kind?: string;
  /** Nomor pesanan terkait, kalau ada — supaya log bisa dicari per pesanan. */
  orderNumber?: string;
}

/**
 * Mencatat satu percobaan kirim ke email_logs.
 *
 * Tidak pernah melempar, dengan alasan yang sama seperti audit log: kegagalan
 * mencatat tidak boleh menggagalkan pengirimannya. Yang dicatat adalah alamat,
 * subjek, dan status — BUKAN isi email, karena isinya sering memuat token reset
 * password dan tautan verifikasi sekali pakai. Menyimpannya berarti membuat
 * tabel yang bisa dibaca admin menjadi jalan pintas untuk mengambil alih akun
 * pengguna mana pun.
 */
async function catatEmail(baris: {
  recipient: string;
  subject: string;
  kind: string;
  orderNumber?: string;
  status: "terkirim" | "gagal";
  providerId?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    const { createServiceClient } = await import("@/lib/db/client.server");
    const { error } = await createServiceClient()
      .from("email_logs")
      .insert({
        recipient: baris.recipient,
        subject: baris.subject,
        kind: baris.kind,
        order_number: baris.orderNumber ?? null,
        status: baris.status,
        provider_id: baris.providerId ?? null,
        error_message: baris.errorMessage ? baris.errorMessage.slice(0, 500) : null,
      });
    if (error) console.error("email log gagal ditulis", error);
  } catch (error) {
    console.error("email log gagal ditulis", error);
  }
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

  const penerima = (Array.isArray(input.to) ? input.to : [input.to]).join(", ");
  const dasar = {
    recipient: penerima,
    subject: input.subject,
    kind: input.kind ?? "lain",
    orderNumber: input.orderNumber,
  };

  let response: Response;
  try {
    response = await fetch(endpoint(), {
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
  } catch (error) {
    // Jaringan putus sebelum Resend menjawab. Dicatat juga — kalau tidak,
    // gangguan koneksi akan terlihat identik dengan "email tidak pernah dikirim".
    await catatEmail({
      ...dasar,
      status: "gagal",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    await catatEmail({
      ...dasar,
      status: "gagal",
      errorMessage: `HTTP ${response.status}: ${body}`,
    });
    throw new EmailSendError(response.status, body);
  }

  const hasil = (await response.json()) as { id: string };
  await catatEmail({ ...dasar, status: "terkirim", providerId: hasil.id });
  return hasil;
}
