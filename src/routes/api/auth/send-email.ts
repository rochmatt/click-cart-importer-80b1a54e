import * as React from "react";
import { render } from "@react-email/render";
import { createFileRoute } from "@tanstack/react-router";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { SignupEmail } from "@/lib/email-templates/signup";
import { EmailSendError, sendEmail } from "@/lib/email/resend.server";
import { WebhookVerifyError, verifyStandardWebhook } from "@/lib/email/verify-webhook.server";

// Endpoint Send Email Hook milik Supabase Auth.
//
// Menggantikan /lovable/email/auth/webhook. Bedanya mendasar: route lama
// menerima format webhook Lovable (Supabase -> platform Lovable -> app ini),
// sedangkan route ini dipanggil Supabase LANGSUNG. Daftarkan di
// Supabase Dashboard -> Authentication -> Hooks -> Send Email:
//
//   URL    : https://inipilihanku.com/api/auth/send-email
//   Secret : salin ke SEND_EMAIL_HOOK_SECRET di .env.server.local

const SITE_NAME = "PasarPilih";

function siteUrl(): string {
  return (process.env.SITE_URL || "https://inipilihanku.com").replace(/\/$/, "");
}

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to?: string;
  email_action_type: string;
  site_url?: string;
  token_new?: string;
  token_hash_new?: string;
  old_email?: string;
}

interface HookPayload {
  user: { email: string; new_email?: string };
  email_data: EmailData;
}

function parsePayload(body: string): HookPayload {
  const parsed = JSON.parse(body) as HookPayload;
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof parsed.user?.email !== "string" ||
    typeof parsed.email_data?.email_action_type !== "string"
  ) {
    throw new Error("Invalid Send Email Hook payload");
  }
  return parsed;
}

/**
 * Link verifikasi Supabase. Yang dikirim sebagai `token` adalah token_hash,
 * bukan `token` — `token` adalah OTP 6 digit yang diketik manual.
 */
function verifyUrl(tokenHash: string, actionType: string, redirectTo?: string): string {
  const base = process.env.SUPABASE_URL;
  if (!base) throw new Error("SUPABASE_URL is not configured");

  const url = new URL("/auth/v1/verify", base);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  url.searchParams.set("redirect_to", redirectTo || siteUrl());
  return url.toString();
}

interface Outgoing {
  to: string;
  subject: string;
  element: React.ReactElement;
}

/**
 * Satu payload email_change bisa menghasilkan dua email, sisanya selalu satu.
 * Mengembalikan array kosong berarti tipe ini memang tidak perlu dikirimi email.
 */
function buildEmails(payload: HookPayload): Outgoing[] {
  const { user, email_data: data } = payload;
  const type = data.email_action_type;
  const link = (hash: string) => verifyUrl(hash, type, data.redirect_to);

  switch (type) {
    case "signup":
      return [
        {
          to: user.email,
          subject: "Confirm your email",
          element: React.createElement(SignupEmail, {
            siteName: SITE_NAME,
            siteUrl: siteUrl(),
            recipient: user.email,
            confirmationUrl: link(data.token_hash),
          }),
        },
      ];

    case "invite":
      return [
        {
          to: user.email,
          subject: "You've been invited",
          element: React.createElement(InviteEmail, {
            siteName: SITE_NAME,
            siteUrl: siteUrl(),
            confirmationUrl: link(data.token_hash),
          }),
        },
      ];

    case "magiclink":
      return [
        {
          to: user.email,
          subject: "Your login link",
          element: React.createElement(MagicLinkEmail, {
            siteName: SITE_NAME,
            confirmationUrl: link(data.token_hash),
          }),
        },
      ];

    case "recovery":
      return [
        {
          to: user.email,
          subject: "Reset your password",
          element: React.createElement(RecoveryEmail, {
            siteName: SITE_NAME,
            confirmationUrl: link(data.token_hash),
          }),
        },
      ];

    case "reauthentication":
      // Satu-satunya tipe tanpa link: pengguna mengetik OTP-nya.
      return [
        {
          to: user.email,
          subject: "Your verification code",
          element: React.createElement(ReauthenticationEmail, { token: data.token }),
        },
      ];

    case "email_change": {
      // Payload tidak menamai mana alamat lama dan mana yang baru secara
      // konsisten, jadi disimpulkan: kalau old_email ada dan beda dengan
      // user.email, berarti user.email adalah alamat barunya.
      const oldEmail = data.old_email || user.email;
      const newEmail = user.new_email || (data.old_email ? user.email : user.email);

      const subject = "Confirm your new email";
      const props = { siteName: SITE_NAME, oldEmail, email: oldEmail, newEmail };

      // PERHATIAN: pemetaan token di bawah memang terbalik. Saat "Secure email
      // change" aktif, Supabase mengirim token_hash_new untuk alamat LAMA dan
      // token_hash untuk alamat BARU — dipertahankan demi backward compat di
      // sisi Supabase. Jangan "dirapikan".
      const secureChange = Boolean(data.token_hash_new) && oldEmail !== newEmail;
      if (!secureChange) {
        return [
          {
            to: newEmail,
            subject,
            element: React.createElement(EmailChangeEmail, {
              ...props,
              confirmationUrl: link(data.token_hash || data.token_hash_new || ""),
            }),
          },
        ];
      }

      return [
        {
          to: oldEmail,
          subject,
          element: React.createElement(EmailChangeEmail, {
            ...props,
            confirmationUrl: link(data.token_hash_new!),
          }),
        },
        {
          to: newEmail,
          subject,
          element: React.createElement(EmailChangeEmail, {
            ...props,
            confirmationUrl: link(data.token_hash),
          }),
        },
      ];
    }

    default:
      // Tipe *_notification (password_changed_notification dan sejenisnya)
      // belum punya template. Diabaikan dengan sengaja supaya Supabase tidak
      // menganggapnya gagal lalu mengulang terus.
      console.warn(`[send-email] tipe tidak ditangani, dilewati: ${type}`);
      return [];
  }
}

/** Tanpa ini, GET jatuh ke router SSR dan membalas etalase dengan status 200. */
const methodNotAllowed = () =>
  Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });

export const Route = createFileRoute("/api/auth/send-email")({
  server: {
    handlers: {
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
      POST: async ({ request }) => {
        const secret = process.env.SEND_EMAIL_HOOK_SECRET;
        if (!secret) {
          console.error("[send-email] SEND_EMAIL_HOOK_SECRET belum diisi");
          return Response.json({ error: "Email hook not configured" }, { status: 500 });
        }

        // Harus body mentah — JSON.parse lalu stringify ulang merusak signature.
        const body = await request.text();

        try {
          verifyStandardWebhook({ body, headers: request.headers, secret });
        } catch (error) {
          if (error instanceof WebhookVerifyError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          console.error("[send-email] verifikasi gagal", error);
          return Response.json({ error: "Verification failed" }, { status: 500 });
        }

        let payload: HookPayload;
        try {
          payload = parsePayload(body);
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        let outgoing: Outgoing[];
        try {
          outgoing = buildEmails(payload);
        } catch (error) {
          console.error("[send-email] gagal menyusun email", error);
          return Response.json({ error: "Failed to build email" }, { status: 500 });
        }

        if (outgoing.length === 0) {
          return Response.json({ success: true, sent: 0 });
        }

        // webhook-id stabil lintas percobaan ulang Supabase, jadi cocok sebagai
        // kunci idempotensi Resend — pengguna tidak menerima email dobel.
        const webhookId = request.headers.get("webhook-id") ?? undefined;

        try {
          for (const [index, mail] of outgoing.entries()) {
            const html = await render(mail.element);
            const text = await render(mail.element, { plainText: true });
            await sendEmail({
              to: mail.to,
              subject: mail.subject,
              html,
              text,
              idempotencyKey: webhookId ? `${webhookId}-${index}` : undefined,
            });
          }
        } catch (error) {
          console.error("[send-email] pengiriman gagal", error);
          // 4xx permanen dijawab 400 supaya Supabase berhenti mengulang;
          // sisanya 500 agar dicoba lagi.
          const permanent = error instanceof EmailSendError && !error.retryable;
          return Response.json(
            { error: "Failed to send email" },
            { status: permanent ? 400 : 500 },
          );
        }

        return Response.json({ success: true, sent: outgoing.length });
      },
    },
  },
});
