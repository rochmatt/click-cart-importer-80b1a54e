import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MailCheck,
  ShieldCheck,
} from "lucide-react";

import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ResendVerification } from "@/components/account/ResendVerification";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const title = "Verifikasi Email Akun — PasarPilih";
const description =
  "Konfirmasi alamat email PasarPilih kamu untuk mengaktifkan akun, mengamankan login, dan menerima notifikasi status pesanan.";

const searchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmailPage,
});

type Status =
  | { kind: "checking" }
  | { kind: "pending" }
  | { kind: "verified"; email: string | null }
  | { kind: "failed"; reason: string };

function VerifyEmailPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [email, setEmail] = useState(search.email ?? "");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errorDescription =
        hash.get("error_description") ?? url.searchParams.get("error_description");

      if (errorDescription) {
        if (!cancelled) {
          setStatus({
            kind: "failed",
            reason: /expired/i.test(errorDescription)
              ? "Tautan verifikasi sudah kedaluwarsa. Kirim ulang tautan baru di bawah."
              : errorDescription,
          });
        }
        return;
      }

      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash") ?? hash.get("token_hash");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type: "signup",
            token_hash: tokenHash,
          });
          if (error) throw error;
        }
      } catch (err) {
        if (!cancelled) {
          setStatus({
            kind: "failed",
            reason:
              err instanceof Error
                ? err.message
                : "Token verifikasi tidak valid atau sudah digunakan.",
          });
        }
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (cancelled) return;

      if (data.user?.email_confirmed_at) {
        setStatus({ kind: "verified", email: data.user.email ?? null });
        setTimeout(() => {
          if (!cancelled) navigate({ to: "/account", replace: true });
        }, 3000);
        return;
      }

      if (data.user?.email) setEmail((prev) => prev || data.user!.email!);
      setStatus({ kind: "pending" });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground">
          <MailCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          Verifikasi email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Satu langkah lagi. Konfirmasi alamat email kamu untuk mengaktifkan akun PasarPilih.
        </p>

        <div aria-live="polite" className="mt-6 space-y-4">
          {status.kind === "checking" && (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Memeriksa status verifikasi…
            </div>
          )}

          {status.kind === "verified" && (
            <div className="rounded-2xl border border-chart-2/30 bg-chart-2/5 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-chart-2">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Email berhasil diverifikasi
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {status.email ? `${status.email} sudah aktif. ` : ""}
                Akun kamu siap dipakai. Mengalihkan ke halaman akun…
              </p>
              <Link
                to="/account"
                className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Ke halaman akun
              </Link>
            </div>
          )}

          {status.kind === "failed" && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Verifikasi gagal
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{status.reason}</p>
            </div>
          )}

          {(status.kind === "pending" || status.kind === "failed") && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">
                Belum menerima tautan verifikasi?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Periksa folder spam/promosi, atau kirim ulang tautan ke email kamu.
              </p>

              <div className="mt-4 space-y-1.5">
                <Label htmlFor="verify-email">Alamat email</Label>
                <Input
                  id="verify-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  autoComplete="email"
                />
              </div>

              <div className="mt-4">
                {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? (
                  <ResendVerification email={email.trim()} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Masukkan alamat email yang kamu pakai saat mendaftar untuk mengaktifkan tombol
                    kirim ulang.
                  </p>
                )}
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Sudah verifikasi di perangkat lain?{" "}
                <Link
                  to="/account"
                  search={{ mode: "signin" }}
                  className="font-semibold text-primary hover:underline"
                >
                  Masuk ke akun
                </Link>
              </p>
            </div>
          )}

          {status.kind !== "checking" && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-chart-2" aria-hidden="true" />
              Verifikasi email membantu mengamankan akun dan notifikasi pesanan kamu.
            </p>
          )}
        </div>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  );
}
