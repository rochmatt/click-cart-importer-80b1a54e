import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  MailCheck,
  ShieldCheck,
} from "lucide-react";

import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const title = "Lupa Kata Sandi — PasarPilih";
const description =
  "Minta tautan pemulihan kata sandi PasarPilih. Masukkan email akunmu, kami kirim tautan verifikasi untuk membuat kata sandi baru.";

const searchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute("/forgot-password")({
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
  component: ForgotPasswordPage,
});

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Email wajib diisi" })
  .email({ message: "Format email tidak valid" })
  .max(255, { message: "Email terlalu panjang" });

const COOLDOWN_SECONDS = 60;

const steps = [
  { label: "Masukkan email", icon: Mail },
  { label: "Buka tautan di email", icon: MailCheck },
  { label: "Buat kata sandi baru", icon: KeyRound },
];

function ForgotPasswordPage() {
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy || cooldown > 0) return;

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Email tidak valid");
      return;
    }

    setError(null);
    setFailed(null);
    setBusy(true);
    try {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (sendError) throw sendError;
      setSent(true);
      setCooldown(COOLDOWN_SECONDS);
      toast.success("Tautan pemulihan terkirim");
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "Gagal mengirim tautan pemulihan. Coba lagi sebentar.";
      setFailed(message);
      toast.error("Gagal mengirim tautan pemulihan");
    } finally {
      setBusy(false);
    }
  }

  const activeStep = sent ? 1 : 0;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Chrome desktop saja — mobile pakai layar penuh khusus */}
      <div className="hidden md:block">
        <AnnouncementBar />
        <Header query="" onQueryChange={() => {}} />
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-6 md:min-h-0 md:py-12">
        <Link
          to="/account"
          search={{ mode: "signin" as const }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke halaman masuk
        </Link>

        <div className="mt-2 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Lupa kata sandi
            </h1>
            <p className="text-sm text-muted-foreground">
              Kami kirim tautan verifikasi ke emailmu.
            </p>
          </div>
        </div>

        {/* Langkah verifikasi */}
        <ol className="mt-6 space-y-2" aria-label="Langkah pemulihan kata sandi">
          {steps.map((step, index) => {
            const done = index < activeStep;
            const current = index === activeStep;
            return (
              <li
                key={step.label}
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
                  current
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : done
                      ? "border-success/40 bg-success/5 text-muted-foreground"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-success text-white"
                      : current
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span className="font-medium">{step.label}</span>
                <step.icon className="ml-auto h-4 w-4 opacity-60" aria-hidden="true" />
              </li>
            );
          })}
        </ol>

        {sent ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 rounded-2xl border border-success/40 bg-success/5 p-4"
          >
            <MailCheck className="h-6 w-6 text-success" aria-hidden="true" />
            <h2 className="mt-2 text-base font-bold text-foreground">Tautan sudah dikirim</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Buka email <strong className="text-foreground">{email}</strong> dan klik tautan
              pemulihan untuk membuat kata sandi baru. Tautan berlaku singkat, jadi segera dibuka.
              Cek folder spam bila belum masuk.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full rounded-full"
                disabled={busy || cooldown > 0}
                onClick={() => submit()}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {cooldown > 0 ? `Kirim ulang dalam ${cooldown}s` : "Kirim ulang tautan"}
              </Button>
              <Button asChild size="lg" className="w-full rounded-full">
                <Link to="/account" search={{ mode: "signin" as const }}>
                  Kembali ke halaman masuk
                </Link>
              </Button>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setFailed(null);
                }}
                className="min-h-11 text-sm font-semibold text-primary hover:underline"
              >
                Ganti alamat email
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email akun</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kamu@email.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "forgot-email-error" : "forgot-email-hint"}
              />
              {error ? (
                <p id="forgot-email-error" className="text-xs text-destructive" aria-live="polite">
                  {error}
                </p>
              ) : (
                <p id="forgot-email-hint" className="text-xs text-muted-foreground">
                  Gunakan email yang kamu pakai saat mendaftar.
                </p>
              )}
            </div>

            {failed && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{failed}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full"
              disabled={busy || cooldown > 0}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy
                ? "Mengirim tautan…"
                : cooldown > 0
                  ? `Tunggu ${cooldown}s`
                  : "Kirim tautan pemulihan"}
            </Button>

            <p className="inline-flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              Demi keamanan, kami tidak memberi tahu apakah email terdaftar. Tautan hanya sampai ke
              email yang benar.
            </p>
          </form>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Belum punya akun?{" "}
          <Link
            to="/account"
            search={{ mode: "register" as const }}
            className="font-semibold text-primary hover:underline"
          >
            Daftar sekarang
          </Link>
        </p>
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}
