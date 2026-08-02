import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, SlidersHorizontal, UserRound } from "lucide-react";

import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountFooter } from "@/components/account/AccountFooter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { displayNameFor, initialsFor, useAuth } from "@/lib/auth";
import {
  type AccountPreferences,
  DEFAULT_PREFERENCES,
  passwordFormSchema,
  profileFormSchema,
} from "@/lib/account-preferences";
import { getMyProfile, updateMyPreferences, updateMyProfile } from "@/lib/account.functions";

const title = "Profil Saya — Pengaturan Akun PasarPilih";
const description =
  "Kelola profil PasarPilih kamu: ubah nama & nomor telepon, ganti kata sandi, dan atur preferensi bahasa, mata uang, serta notifikasi.";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type Errors = Record<string, string>;

function ProfilePage() {
  const { loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/account", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans antialiased">
      <AccountHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Profil saya
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ubah data diri, ganti kata sandi, dan atur preferensi akun kamu.
        </p>

        {loading || !user ? (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat profil…
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <ProfileDataCard />
            <PasswordCard />
            <PreferencesCard />
            <p className="text-xs text-muted-foreground">
              Butuh melihat pesanan atau alamat pengiriman?{" "}
              <Link to="/account" className="font-semibold text-primary hover:underline">
                Buka panel akun
              </Link>
              .
            </p>
          </div>
        )}
      </main>

      <AccountFooter />
    </div>
  );
}

function Card({
  icon: Icon,
  heading,
  hint,
  children,
}: {
  icon: typeof UserRound;
  heading: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">{heading}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function ProfileDataCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);

  const profileQuery = useQuery({
    queryKey: ["account", "profile"],
    queryFn: () => fetchProfile(),
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (profileQuery.data && !touched) {
      setName(profileQuery.data.display_name || displayNameFor(user));
      setPhone(profileQuery.data.phone);
    }
  }, [profileQuery.data, touched, user]);

  const save = useMutation({
    mutationFn: (input: { display_name: string; phone: string }) =>
      saveProfile({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
      setTouched(false);
      toast.success("Data profil tersimpan");
    },
    onError: () => toast.error("Gagal menyimpan profil. Coba lagi."),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileFormSchema.safeParse({ display_name: name, phone });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  }

  const label = name || displayNameFor(user);

  return (
    <Card icon={UserRound} heading="Data diri" hint="Nama ini tampil pada pesanan dan ulasan kamu.">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
          {initialsFor(label)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={submit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Nama tampilan</Label>
          <Input
            id="p-name"
            value={name}
            onChange={(e) => {
              setTouched(true);
              setName(e.target.value);
            }}
            maxLength={80}
            aria-invalid={Boolean(errors.display_name)}
          />
          <FieldError message={errors.display_name} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-phone">Nomor telepon</Label>
          <Input
            id="p-phone"
            value={phone}
            onChange={(e) => {
              setTouched(true);
              setPhone(e.target.value);
            }}
            placeholder="+62 812 3456 7890"
            inputMode="tel"
            maxLength={30}
            aria-invalid={Boolean(errors.phone)}
          />
          <FieldError message={errors.phone} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-email">Email</Label>
          <Input id="p-email" value={user?.email ?? ""} disabled readOnly />
          <p className="text-xs text-muted-foreground">
            Email tidak bisa diubah dari halaman ini.
          </p>
        </div>

        <SubmitButton pending={save.isPending}>Simpan data</SubmitButton>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordFormSchema.safeParse({
      current_password: current,
      new_password: next,
      confirm_password: confirm,
    });
    if (!parsed.success) {
      const nextErrors: Errors = {};
      for (const issue of parsed.error.issues) {
        nextErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    if (!user?.email) {
      toast.error("Akun kamu tidak punya email untuk verifikasi.");
      return;
    }

    setPending(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (reauthError) {
        setErrors({ current_password: "Password saat ini salah" });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        toast.error(error.message || "Gagal mengubah password.");
        return;
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password berhasil diubah");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      icon={KeyRound}
      heading="Ubah password"
      hint="Minimal 8 karakter dengan huruf besar, huruf kecil, dan angka."
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Password saat ini</Label>
          <Input
            id="pw-current"
            type={show ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            aria-invalid={Boolean(errors.current_password)}
          />
          <FieldError message={errors.current_password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pw-new">Password baru</Label>
          <Input
            id="pw-new"
            type={show ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.new_password)}
          />
          <FieldError message={errors.new_password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Ulangi password baru</Label>
          <Input
            id="pw-confirm"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirm_password)}
          />
          <FieldError message={errors.confirm_password} />
        </div>

        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {show ? "Sembunyikan password" : "Tampilkan password"}
        </button>

        <div>
          <SubmitButton pending={pending}>Ubah password</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

const TOGGLES: { key: keyof AccountPreferences; label: string; hint: string }[] = [
  {
    key: "email_order_updates",
    label: "Update status pesanan",
    hint: "Email saat pesanan diproses, dikirim, atau tiba.",
  },
  {
    key: "email_promos",
    label: "Promo & penawaran",
    hint: "Email berisi diskon dan kampanye pilihan.",
  },
  {
    key: "email_price_drop",
    label: "Harga turun di wishlist",
    hint: "Email saat produk wishlist kamu turun harga.",
  },
  {
    key: "whatsapp_updates",
    label: "Notifikasi WhatsApp",
    hint: "Butuh nomor telepon aktif pada data diri.",
  },
];

function PreferencesCard() {
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const savePrefs = useServerFn(updateMyPreferences);

  const profileQuery = useQuery({
    queryKey: ["account", "profile"],
    queryFn: () => fetchProfile(),
  });

  const [prefs, setPrefs] = useState<AccountPreferences>(DEFAULT_PREFERENCES);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (profileQuery.data && !touched) setPrefs(profileQuery.data.preferences);
  }, [profileQuery.data, touched]);

  const save = useMutation({
    mutationFn: (input: AccountPreferences) => savePrefs({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
      setTouched(false);
      toast.success("Preferensi tersimpan");
    },
    onError: () => toast.error("Gagal menyimpan preferensi. Coba lagi."),
  });

  const phoneMissing = !profileQuery.data?.phone?.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (prefs.whatsapp_updates && phoneMissing) {
      toast.error("Isi nomor telepon dulu untuk mengaktifkan notifikasi WhatsApp.");
      return;
    }
    save.mutate(prefs);
  }

  function set<K extends keyof AccountPreferences>(key: K, value: AccountPreferences[K]) {
    setTouched(true);
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card
      icon={SlidersHorizontal}
      heading="Preferensi"
      hint="Atur bahasa, mata uang, dan notifikasi yang kamu terima."
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pref-lang">Bahasa</Label>
            <Select value={prefs.language} onValueChange={(v) => set("language", v as "id" | "en")}>
              <SelectTrigger id="pref-lang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id">Bahasa Indonesia</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pref-currency">Mata uang</Label>
            <Select
              value={prefs.currency}
              onValueChange={(v) => set("currency", v as "IDR" | "USD")}
            >
              <SelectTrigger id="pref-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IDR">Rupiah (IDR)</SelectItem>
                <SelectItem value="USD">US Dollar (USD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ul className="divide-y divide-border rounded-xl border border-border">
          {TOGGLES.map((item) => {
            const disabled = item.key === "whatsapp_updates" && phoneMissing;
            return (
              <li key={item.key} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <Switch
                  checked={Boolean(prefs[item.key])}
                  disabled={disabled}
                  onCheckedChange={(v) => set(item.key, v as AccountPreferences[typeof item.key])}
                  aria-label={item.label}
                />
              </li>
            );
          })}
        </ul>

        <SubmitButton pending={save.isPending}>Simpan preferensi</SubmitButton>
      </form>
    </Card>
  );
}
