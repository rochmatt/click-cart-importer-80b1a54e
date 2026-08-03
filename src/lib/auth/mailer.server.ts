// Pengiriman email autentikasi milik sendiri.
//
// Template React Email yang sudah ada dipakai apa adanya — yang berubah hanya
// tujuan tautannya. Versi Supabase mengarah ke .../auth/v1/verify dengan
// token_hash; di sini tautannya menunjuk halaman aplikasi sendiri dan token
// diverifikasi oleh auth.tokens.

import * as React from "react";
import { render } from "@react-email/render";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { SignupEmail } from "@/lib/email-templates/signup";
import { sendEmail } from "@/lib/email/resend.server";

const SITE_NAME = "PasarPilih";

function siteUrl(): string {
  return (process.env.SITE_URL || "https://inipilihanku.com").replace(/\/$/, "");
}

/**
 * Tautan dibuat dengan URL/URLSearchParams, bukan perangkaian string: token
 * base64url tidak mengandung karakter yang perlu di-escape, tapi merangkai
 * query secara manual adalah kebiasaan yang cepat berubah jadi bug ketika
 * parameter bertambah.
 */
function tautan(path: string, token: string): string {
  const url = new URL(path, siteUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

async function kirim(to: string, subject: string, element: React.ReactElement): Promise<void> {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  await sendEmail({ to, subject, html, text });
}

export async function kirimEmailVerifikasi(to: string, token: string): Promise<void> {
  await kirim(
    to,
    "Confirm your email",
    React.createElement(SignupEmail, {
      siteName: SITE_NAME,
      siteUrl: siteUrl(),
      recipient: to,
      confirmationUrl: tautan("/verify-email", token),
    }),
  );
}

export async function kirimEmailReset(to: string, token: string): Promise<void> {
  await kirim(
    to,
    "Reset your password",
    React.createElement(RecoveryEmail, {
      siteName: SITE_NAME,
      confirmationUrl: tautan("/reset-password", token),
    }),
  );
}
