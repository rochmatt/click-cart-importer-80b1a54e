import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const title = "Atur Ulang Kata Sandi — PasarPilih";
const description =
  "Buat kata sandi baru untuk akun PasarPilih kamu setelah membuka tautan pemulihan yang kami kirim lewat email.";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
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
  component: ResetPasswordPage,
});

type TokenState =
  | { status: "verifying" }
  | { status: "valid"; email: string | null }
  | { status: "invalid"; reason: string };

function scorePassword(value: string) {
  const checks = {
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score };
}

const strengthLabel = ["Sangat lemah", "Lemah", "Cukup", "Kuat", "Sangat kuat"];
const strengthTone = [
  "bg-destructive",
  "bg-destructive",
  "bg-chart-4",
  "bg-chart-2",
  "bg-chart-2",
];

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [token, setToken] = useState<TokenState>({ status: "verifying" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const { checks, score } = useMemo(() => scorePassword(password), [password]);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const hashError = hash.get("error_description") ?? url.searchParams.get("error_description");

      if (hashError) {
        if (!cancelled) {
          setToken({
            status: "invalid",
            reason:
              /expired/i.test(hashError)
                ? "Tautan pemulihan sudah kedaluwarsa. Minta tautan baru untuk melanjutkan."
                : hashError,
          });
        }
        return;
      }

      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash") ?? hash.get("token_hash");

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          if (otpError) throw otpError;
        }
      } catch (err) {
        if (!cancelled) {
          setToken({
            status: "invalid",
            reason:
              err instanceof Error
                ? err.message
                : "Token pemulihan tidak valid atau sudah dipakai.",
          });
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setToken({ status: "valid", email: data.session.user.email ?? null });
      } else {
        setToken({
          status: "invalid",
          reason:
            "Kami tidak menemukan token pemulihan yang aktif. Buka tautan dari email di perangkat ini.",
        });
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setToken({ status: "valid", email: session.user.email ?? null });
      }
    });

    verify();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    if (score < 2) {
      setError("Kata sandi terlalu lemah. Tambahkan huruf besar, angka, atau simbol.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      toast.success("Kata sandi berhasil diperbarui.");
      setTimeout(() => navigate({ to: "/account", replace: true }), 2500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Kata sandi gagal diperbarui. Coba lagi.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
          Atur ulang kata sandi
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Buat kata sandi baru yang kuat untuk mengamankan akun PasarPilih kamu.
        </p>

        <div aria-live="polite" className="mt-6">
          {token.status === "verifying" && (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Memverifikasi tautan pemulihan…
            </div>
          )}

          {token.status === "invalid" && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Tautan tidak valid
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{token.reason}</p>
              <Link
                to="/account"
                search={{ mode: "signin" }}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Minta tautan baru
              </Link>
            </div>
          )}

          {token.status === "valid" && done && (
            <div className="rounded-2xl border border-chart-2/30 bg-chart-2/5 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-chart-2">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Kata sandi berhasil diubah
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Kamu sudah masuk dengan kata sandi baru. Mengalihkan ke halaman akun…
              </p>
              <Link
                to="/account"
                className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Ke halaman akun
              </Link>
            </div>
          )}

          {token.status === "valid" && !done && (
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              {token.email && (
                <p className="rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
                  Mengatur ulang kata sandi untuk{" "}
                  <span className="font-semibold text-foreground">{token.email}</span>
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="new-password">Kata sandi baru</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Minimal 8 karakter"
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby="password-rules"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {password && (
                  <div className="pt-1">
                    <div className="flex gap-1" aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < score ? strengthTone[score] : "bg-border"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Kekuatan: <span className="font-semibold">{strengthLabel[score]}</span>
                    </p>
                  </div>
                )}

                <ul id="password-rules" className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {[
                    ["Minimal 8 karakter", checks.length],
                    ["Ada huruf kapital", checks.upper],
                    ["Ada angka", checks.number],
                    ["Ada simbol (opsional)", checks.symbol],
                  ].map(([label, ok]) => (
                    <li key={String(label)} className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 ${ok ? "text-chart-2" : "text-border"}`}
                        aria-hidden="true"
                      />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Konfirmasi kata sandi</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Ulangi kata sandi baru"
                />
                {confirm && confirm !== password && (
                  <p className="text-xs text-destructive">Konfirmasi kata sandi tidak sama.</p>
                )}
              </div>

              {error && (
                <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Simpan kata sandi baru
              </button>

              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-chart-2" aria-hidden="true" />
                Koneksi terenkripsi. Kata sandi kamu tidak pernah kami simpan dalam bentuk teks.
              </p>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
