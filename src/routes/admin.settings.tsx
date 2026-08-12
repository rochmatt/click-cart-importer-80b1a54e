import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, Settings, ShieldCheck, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type StoreSettings,
  getGoogleOAuth,
  getStoreSettings,
  grantRole,
  listStaff,
  revokeRole,
  updateGoogleOAuth,
  updateStoreSettings,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PasarPilih Admin" },
      { name: "description", content: "Store profile, staff access and marketplace defaults for PasarPilih." },
      { property: "og:title", content: "Settings — PasarPilih Admin" },
      { property: "og:description", content: "Configure store details and marketplace defaults for PasarPilih." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-foreground">
          <Settings className="h-5 w-5 text-primary" />
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Store profile, staff access and marketplace defaults.
        </p>
      </header>

      <StoreProfileCard />
      <GoogleOAuthCard />
      <StaffCard />
    </div>
  );
}

function StoreProfileCard() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getStoreSettings);
  const save = useServerFn(updateStoreSettings);
  const [form, setForm] = useState<StoreSettings | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => fetchSettings(),
  });

  useEffect(() => {
    if (settingsQuery.data && !form) setForm(settingsQuery.data);
  }, [settingsQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: (input: StoreSettings) => save({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Store settings saved");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not save settings"),
  });

  if (settingsQuery.isLoading || !form) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </p>
    );
  }

  const set = (patch: Partial<StoreSettings>) => setForm({ ...form, ...patch });

  return (
    <form
      className="rounded-2xl border border-border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate(form);
      }}
    >
      <h2 className="text-sm font-bold text-foreground">Store identity</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Store name" value={form.store_name} onChange={(v) => set({ store_name: v })} />
        <Field label="Tagline" value={form.tagline} onChange={(v) => set({ tagline: v })} />
        <Field label="Support email" value={form.support_email} onChange={(v) => set({ support_email: v })} />
        <Field label="Support phone" value={form.support_phone} onChange={(v) => set({ support_phone: v })} />
        <Field label="Logo URL" value={form.logo_url} onChange={(v) => set({ logo_url: v })} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="store-address">Store address</Label>
          <Textarea
            id="store-address"
            rows={2}
            value={form.store_address}
            onChange={(e) => set({ store_address: e.target.value })}
          />
        </div>
      </div>

      <h2 className="mt-6 text-sm font-bold text-foreground">Marketplace link defaults</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Shopee template" value={form.shopee_link_template} onChange={(v) => set({ shopee_link_template: v })} placeholder="https://shopee.co.id/shop/..." />
        <Field label="Tokopedia template" value={form.tokopedia_link_template} onChange={(v) => set({ tokopedia_link_template: v })} placeholder="https://tokopedia.com/store/..." />
        <Field label="TikTok template" value={form.tiktok_link_template} onChange={(v) => set({ tiktok_link_template: v })} placeholder="https://tiktok.com/@store/..." />
        <Field label="UTM source" value={form.utm_source} onChange={(v) => set({ utm_source: v })} />
        <Field label="UTM medium" value={form.utm_medium} onChange={(v) => set({ utm_medium: v })} />
        <Field label="UTM campaign" value={form.utm_campaign} onChange={(v) => set({ utm_campaign: v })} />
      </div>

      <button
        type="submit"
        disabled={saveMutation.isPending}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Save settings
      </button>
    </form>
  );
}

function GoogleOAuthCard() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getGoogleOAuth);
  const save = useServerFn(updateGoogleOAuth);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["admin", "google-oauth"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    // Isi Client ID sekali dari server; Secret sengaja TIDAK pernah diisi ulang
    // (write-only) — kosong berarti "pertahankan yang tersimpan".
    if (statusQuery.data && !seeded) {
      setClientId(statusQuery.data.client_id);
      setSeeded(true);
    }
  }, [statusQuery.data, seeded]);

  const saveMutation = useMutation({
    mutationFn: (input: { client_id: string; client_secret: string }) => save({ data: input }),
    onSuccess: () => {
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["admin", "google-oauth"] });
      toast.success("Kredensial Google disimpan — langsung aktif, tanpa restart");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan kredensial"),
  });

  const status = statusQuery.data;
  const redirectUri = status?.redirect_uri ?? "https://inipilihanku.com/api/auth/google/callback";

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Tidak bisa menyalin otomatis — salin manual dari kolomnya");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <KeyRound className="h-4 w-4 text-primary" />
          Login Google (OAuth)
        </h2>
        {status &&
          (status.active ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <Check className="h-3.5 w-3.5" /> Aktif
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Belum aktif
            </span>
          ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Tempel Client ID &amp; Client Secret dari Google Cloud Console di sini. Secret disimpan aman
        di server dan tidak pernah ditampilkan kembali. Perubahan langsung berlaku — tanpa restart.
      </p>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="google-redirect">Authorized redirect URI (salin ke Google Console)</Label>
        <div className="flex gap-2">
          <Input
            id="google-redirect"
            readOnly
            value={redirectUri}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <button
            type="button"
            onClick={copyRedirect}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Tersalin" : "Salin"}
          </button>
        </div>
      </div>

      {statusQuery.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat status…
        </p>
      ) : (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({ client_id: clientId, client_secret: clientSecret });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="google-client-id">Client ID</Label>
            <Input
              id="google-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="1234567890-abc.apps.googleusercontent.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="google-client-secret">Client Secret</Label>
            <Input
              id="google-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={status?.has_secret ? "•••••••• tersimpan (kosongkan = tetap)" : "GOCSPX-…"}
              autoComplete="new-password"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Simpan kredensial
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function StaffCard() {
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listStaff);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "moderator">("admin");

  const staffQuery = useQuery({ queryKey: ["admin", "staff"], queryFn: () => fetchStaff() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });

  const grantMutation = useMutation({
    mutationFn: (input: { email: string; role: "admin" | "moderator" }) => grant({ data: input }),
    onSuccess: (result) => {
      if (result.ok) {
        setEmail("");
        invalidate();
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    onError: () => toast.error("Could not update roles"),
  });

  const revokeMutation = useMutation({
    mutationFn: (input: { user_id: string; role: "admin" | "moderator" | "user" }) =>
      revoke({ data: input }),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    onError: () => toast.error("Could not update roles"),
  });

  const staff = staffQuery.data ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Staff access
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Only admins can create, edit, delete or publish products. The person must already have an
        account before you grant a role.
      </p>

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          grantMutation.mutate({ email: email.trim(), role });
        }}
      >
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <Label htmlFor="staff-email">Account email</Label>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-role">Role</Label>
          <select
            id="staff-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "moderator")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="admin">admin</option>
            <option value="moderator">moderator</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={grantMutation.isPending || !email.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {grantMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Grant role
        </button>
      </form>

      {staffQuery.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading staff…
        </p>
      ) : staff.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No roles granted yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {staff.map((member) => (
            <li
              key={`${member.user_id}-${member.role}`}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {member.display_name || member.email || member.user_id}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
                  {member.role}
                </span>
                <button
                  type="button"
                  aria-label={`Revoke ${member.role}`}
                  onClick={() =>
                    revokeMutation.mutate({
                      user_id: member.user_id,
                      role: member.role as "admin" | "moderator" | "user",
                    })
                  }
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = `setting-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
