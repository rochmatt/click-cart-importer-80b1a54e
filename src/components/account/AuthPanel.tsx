import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Package,
  ShieldCheck,
  Truck,
  UserPlus,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

type Mode = "signin" | "register";

const emailSchema = z.string().trim().email("Masukkan alamat email yang valid").max(255);

const credentialsSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(72, "Password terlalu panjang"),
    name: z.string().trim().max(80, "Nama terlalu panjang").optional(),
    confirm: z.string().optional(),
    terms: z.boolean().optional(),
    mode: z.enum(["signin", "register"]),
  })
  .superRefine((value, ctx) => {
    if (value.mode !== "register") return;
    if (!value.name || value.name.length < 2) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Nama minimal 2 karakter" });
    }
    if (value.confirm !== value.password) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Konfirmasi password tidak sama" });
    }
    if (!value.terms) {
      ctx.addIssue({
        code: "custom",
        path: ["terms"],
        message: "Kamu perlu menyetujui syarat & kebijakan privasi",
      });
    }
  });

const RESEND_KEY = "pasarpilih.auth.lastEmail";

function scorePassword(password: string) {
  const checks = [
    { label: "Minimal 8 karakter", ok: password.length >= 8 },
    { label: "Huruf besar & kecil", ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "Mengandung angka", ok: /\d/.test(password) },
    { label: "Simbol (!@#$…)", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const meta =
    score <= 1
      ? { label: "Lemah", tone: "bg-destructive", text: "text-destructive" }
      : score === 2
        ? { label: "Cukup", tone: "bg-chart-4", text: "text-chart-4" }
        : score === 3
          ? { label: "Kuat", tone: "bg-primary", text: "text-primary" }
          : { label: "Sangat kuat", tone: "bg-success", text: "text-success" };
  return { checks, score, ...meta };
}

export function AuthPanel({
  initialMode,
  nextPath,
}: {
  initialMode: Mode;
  nextPath?: string;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => setMode(initialMode), [initialMode]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RESEND_KEY);
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const strength = useMemo(() => scorePassword(password), [password]);

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    setSentConfirmation(false);
    setResetSent(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password, name, confirm, terms, mode });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (remember) {
        try {
          window.localStorage.setItem(RESEND_KEY, parsed.data.email);
        } catch {
          /* ignore */
        }
      }
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Berhasil masuk. Selamat datang kembali!");
        if (nextPath) window.location.href = nextPath;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo:
              window.location.origin +
              (nextPath ? `/verify-email?next=${encodeURIComponent(nextPath)}` : "/verify-email"),
            data: { display_name: parsed.data.name ?? "" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSentConfirmation(true);
          toast.success("Cek inbox kamu untuk konfirmasi email");
          navigate({ to: "/verify-email", search: { email: parsed.data.email } });
        } else {
          toast.success("Akun berhasil dibuat. Selamat berbelanja!");
          if (nextPath) window.location.href = nextPath;
        }
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      const message = /invalid login credentials/i.test(raw)
        ? "Email atau password salah."
        : /already registered|already exists/i.test(raw)
          ? "Email ini sudah terdaftar. Coba masuk saja."
          : raw || "Terjadi kesalahan. Coba lagi.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setGoogleBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/account",
      });
      if (result.error) {
        toast.error("Masuk dengan Google gagal. Coba lagi.");
        return;
      }
    } catch {
      toast.error("Masuk dengan Google gagal. Coba lagi.");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function onForgotPassword() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setErrors({ email: "Isi email dulu, lalu minta link reset password" });
      return;
    }
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Link reset password terkirim");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengirim link reset");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-secondary/40 px-5 py-4 sm:px-6">
          <div
            role="tablist"
            aria-label="Pilih masuk atau daftar"
            className="inline-flex w-full rounded-full bg-background p-1 sm:w-auto"
          >
            {(["signin", "register"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-none ${
                  mode === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "signin" ? (
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                )}
                {value === "signin" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Masuk untuk melanjutkan checkout dan melihat riwayat pesanan kamu."
              : "Buat akun gratis — simpan alamat, wishlist, dan lacak pesanan otomatis."}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          {sentConfirmation ? (
            <div className="rounded-xl border border-border bg-secondary/60 p-4 text-sm text-muted-foreground">
              <Mail className="mb-2 h-5 w-5 text-primary" aria-hidden="true" />
              Kami mengirim link konfirmasi ke{" "}
              <strong className="text-foreground">{email}</strong>. Buka link tersebut untuk
              mengaktifkan akun, lalu masuk di sini.
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="mt-3 block text-xs font-semibold text-primary hover:underline"
              >
                Kembali ke halaman masuk
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nama lengkap</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Budi Santoso"
                    autoComplete="name"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                  {errors.name && (
                    <p id="name-error" className="text-xs text-destructive">
                      {errors.name}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kamu@email.com"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />

                {errors.email && (
                  <p id="email-error" className="text-xs text-destructive">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && !resetSent && (
                    <Link
                      to="/forgot-password"
                      search={{ email: email || undefined }}
                      className="inline-flex items-center gap-1 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Lupa password?
                    </Link>
                  )}

                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                    placeholder={mode === "signin" ? "Password kamu" : "Minimal 8 karakter"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pr-12"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {capsOn && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="inline-flex items-center gap-1 text-xs text-chart-4"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    Caps Lock sedang aktif
                  </p>
                )}

                {errors.password && (
                  <p id="password-error" className="text-xs text-destructive">
                    {errors.password}
                  </p>
                )}

                {mode === "register" && password.length > 0 && (
                  <div className="space-y-2 pt-1" aria-live="polite">
                    <div className="flex items-center gap-2">
                      <div className="flex h-1.5 flex-1 gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={`h-full flex-1 rounded-full ${
                              i < strength.score ? strength.tone : "bg-border"
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs font-semibold ${strength.text}`}>
                        {strength.label}
                      </span>
                    </div>
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {strength.checks.map((check) => (
                        <li
                          key={check.label}
                          className={`inline-flex items-center gap-1.5 text-xs ${
                            check.ok ? "text-success" : "text-muted-foreground"
                          }`}
                        >
                          {check.ok ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {check.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Ulangi password</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                      placeholder="Ketik ulang password"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="pr-12"
                      aria-invalid={Boolean(errors.confirm)}
                      aria-describedby={errors.confirm ? "confirm-error" : "confirm-hint"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {confirm.length > 0 && !errors.confirm && (
                    <p
                      id="confirm-hint"
                      aria-live="polite"
                      className={`inline-flex items-center gap-1.5 text-xs ${
                        confirm === password ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      {confirm === password ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {confirm === password ? "Password cocok" : "Password belum cocok"}
                    </p>
                  )}
                  {errors.confirm && (
                    <p id="confirm-error" className="text-xs text-destructive">
                      {errors.confirm}
                    </p>
                  )}
                </div>
              )}


              {mode === "signin" ? (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(value) => setRemember(value === true)}
                    aria-label="Ingat email saya di perangkat ini"
                  />
                  Ingat email saya di perangkat ini
                </label>
              ) : (
                <div className="space-y-1.5">
                  <label className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={terms}
                      onCheckedChange={(value) => setTerms(value === true)}
                      className="mt-0.5"
                      aria-label="Setuju dengan syarat & ketentuan dan kebijakan privasi"
                    />
                    <span>
                      Saya setuju dengan{" "}
                      <Link to="/terms-of-service" className="font-semibold text-primary hover:underline">
                        Syarat &amp; Ketentuan
                      </Link>{" "}
                      dan{" "}
                      <Link to="/privacy-policy" className="font-semibold text-primary hover:underline">
                        Kebijakan Privasi
                      </Link>
                      .
                    </span>
                  </label>
                  {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}
                </div>
              )}

              <Button type="submit" size="lg" disabled={busy} className="w-full rounded-full">
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {mode === "signin" ? "Masuk" : "Buat akun"}
              </Button>
            </form>
          )}

          {resetSent && (
            <p className="mt-4 rounded-xl border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
              <KeyRound className="mb-1 h-4 w-4 text-primary" aria-hidden="true" />
              Kami mengirim link reset password ke{" "}
              <strong className="text-foreground">{email}</strong>. Buka di perangkat ini untuk
              membuat password baru.
            </p>
          )}

          {!sentConfirmation && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">atau</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onGoogle}
                disabled={googleBusy}
                className="w-full rounded-full"
              >
                {googleBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <GoogleGlyph />
                )}
                Lanjutkan dengan Google
              </Button>

              <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                Koneksi terenkripsi. Kami tidak pernah membagikan data kamu.
              </p>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
                <button
                  type="button"
                  onClick={() => switchMode(mode === "signin" ? "register" : "signin")}
                  className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {mode === "signin" ? "Daftar sekarang" : "Masuk di sini"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>

      <SideBenefits mode={mode} />
    </div>
  );
}

const benefits = [
  { icon: Package, title: "Riwayat pesanan", text: "Semua transaksi tersimpan rapi di satu tempat." },
  { icon: Truck, title: "Lacak otomatis", text: "Status pengiriman diperbarui tanpa input manual." },
  { icon: Heart, title: "Wishlist tersimpan", text: "Simpan produk favorit dan beli kapan saja." },
  { icon: BadgeCheck, title: "Checkout lebih cepat", text: "Alamat & kontak terisi otomatis." },
];

function SideBenefits({ mode }: { mode: Mode }) {
  return (
    <aside className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-bold text-foreground">
          {mode === "register" ? "Kenapa daftar di PasarPilih?" : "Keuntungan punya akun"}
        </p>
        <ul className="mt-4 space-y-3">
          {benefits.map((benefit) => (
            <li key={benefit.title} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                <benefit.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                <p className="text-xs text-muted-foreground">{benefit.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">Aman & terlindungi</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Password kamu dienkripsi dan tidak pernah bisa dilihat siapa pun, termasuk tim kami.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">Tanpa akun?</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Kamu tetap bisa melacak kiriman memakai nomor pesanan.
        </p>
        <Link
          to="/track"
          className="mt-3 inline-block rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Lacak pesanan
        </Link>
      </div>
    </aside>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
