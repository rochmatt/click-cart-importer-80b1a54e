import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
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
import { passwordResetCooldown, requestPasswordReset } from "@/lib/auth/auth.functions";
import {
  AMBANG_JAM_DINDING_DETIK,
  formatSisa,
  jamKembali,
  useKuotaKirim,
} from "@/lib/auth/use-kuota-kirim";

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

// COOLDOWN_SECONDS lokal dihapus. Angkanya 60 detik datar dan hanya hidup di
// state React, jadi memuat ulang halaman langsung mengembalikan tombolnya —
// sementara server memakai angka lain lagi. Sisa waktunya kini datang dari
// server dan berlaku sama di semua perangkat.

const ambilStatusReset = (email: string) => passwordResetCooldown({ data: { email } });

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
  // Alamat yang statusnya sedang dipantau. Dikunci saat halaman dibuka dan
  // setelah setiap pengiriman — TIDAK ikut tiap ketikan, karena memanggil
  // server pada setiap huruf yang diketik akan menembakkan puluhan permintaan.
  const [emailDipantau] = useState(() => {
    const parsed = emailSchema.safeParse(search.email ?? "");
    return parsed.success ? parsed.data : "";
  });

  const kuota = useKuotaKirim(ambilStatusReset, emailDipantau);
  const cooldown = kuota.sisa;

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
      // Server selalu menjawab ok, termasuk untuk email tak dikenal — halaman
      // ini tidak boleh bisa dipakai memeriksa keberadaan akun.
      const hasil = await requestPasswordReset({ data: { email: parsed.data } });
      kuota.terapkan(hasil);

      if (hasil.diizinkan) {
        setSent(true);
        // Tidak menjanjikan "terkirim": apakah alamatnya terdaftar memang tidak
        // pernah diberitahukan, jadi kalimatnya dibuat sesuai kenyataan.
        toast.success("Kalau alamat itu terdaftar, tautan pemulihan sudah dikirim");
      } else if (hasil.terpakai >= hasil.maks) {
        toast.error(
          `Batas ${hasil.maks} permintaan per jam tercapai. Coba lagi dalam ${formatSisa(hasil.sisaDetik)}.`,
        );
      } else {
        toast.error(`Tunggu ${formatSisa(hasil.sisaDetik)} sebelum meminta tautan lagi`);
      }
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
              {busy ? "Mengirim tautan…" : cooldown > 0 ? "Menunggu…" : "Kirim tautan pemulihan"}
            </Button>

            {/*
              Hitungan mundur di LUAR tombol dan tanpa aria-live: teksnya berubah
              tiap detik, dan region yang mengumumkannya akan dibacakan pembaca
              layar sekali per detik. Perubahan keadaan yang layak diumumkan
              ditangani region tersendiri di bawah.
            */}
            {cooldown > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                <Clock
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-muted-foreground">
                  {kuota.maksTercapai && (
                    <>
                      <span className="font-semibold text-foreground">Maksimal tercapai</span> —{" "}
                      {kuota.status?.maks} permintaan dalam satu jam.{" "}
                    </>
                  )}
                  {cooldown >= AMBANG_JAM_DINDING_DETIK ? (
                    <>
                      Bisa dicoba lagi sekitar pukul{" "}
                      <span className="font-medium text-foreground">{jamKembali(cooldown)}</span>{" "}
                      <span className="tabular-nums">({formatSisa(cooldown)} lagi)</span>
                    </>
                  ) : (
                    <>
                      Bisa dicoba lagi dalam{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatSisa(cooldown)}
                      </span>
                    </>
                  )}
                  . Batas ini berlaku untuk semua perangkat.
                </p>
              </div>
            )}

            <p role="status" aria-live="polite" className="sr-only">
              {kuota.maksTercapai
                ? `Maksimal ${kuota.status?.maks} permintaan per jam tercapai. Tombol kirim tidak aktif.`
                : cooldown > 0
                  ? "Menunggu jeda sebelum permintaan berikutnya."
                  : "Tombol kirim tautan aktif."}
            </p>

            <p className="inline-flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                aria-hidden="true"
              />
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
