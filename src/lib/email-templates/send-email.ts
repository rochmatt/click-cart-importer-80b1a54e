import * as React from "react";
import { render } from "@react-email/render";
import { sendEmail } from "@/lib/email/resend.server";
import { TEMPLATES } from "./registry";

// Server-only: membaca RESEND_API_KEY lewat resend.server. Jangan di-import
// dari komponen client.

export type SendTemplateEmailResult =
  { sent: true } | { sent: false; reason: "recipient_suppressed" };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>;
  /** Mencegah kiriman dobel saat percobaan ulang; Resend menahannya 24 jam. */
  idempotencyKey?: string;
  replyTo?: string;
}

/**
 * Merender template terdaftar lalu mengirimnya lewat Resend.
 *
 * Sengaja MELEMPAR error saat RESEND_API_KEY belum diisi, bukan mengembalikan
 * { sent: false }. Alasannya ada di pemanggil: hook order-status-emails
 * menandai pesanan sebagai sudah dinotifikasi kecuali terjadi throw — kalau
 * kegagalan konfigurasi dilaporkan sebagai nilai kembalian biasa, pesanan
 * tertandai "sudah dikirimi email" padahal tidak ada yang terkirim.
 *
 * Catatan: Resend tidak melaporkan suppression pada respons kirim, jadi cabang
 * { sent: false } praktis tidak pernah terjadi. Tipenya dipertahankan supaya
 * pemanggil yang sudah ada tidak perlu ikut diubah.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // `to` milik template menang — template notifikasi selalu ke alamat tetapnya.
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  await sendEmail({
    to: recipient,
    subject,
    html,
    text,
    replyTo: options.replyTo,
    idempotencyKey: options.idempotencyKey,
    // Nama template dipakai apa adanya sebagai jenis email di Log Email: ia
    // sudah membedakan order-shipped dari order-refunded, dan menambah pemetaan
    // sendiri hanya akan jadi daftar kedua yang harus ikut diperbarui.
    kind: templateName,
    orderNumber:
      typeof templateData === "object" && templateData !== null
        ? ((templateData as Record<string, unknown>).orderNumber as string | undefined)
        : undefined,
  });

  return { sent: true };
}
