import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  Heart,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Package,
  Settings,
  ShieldAlert,
  Truck,
  UserPlus,
} from "lucide-react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { AddressBook } from "@/components/account/AddressBook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { displayNameFor, initialsFor, useAuth } from "@/lib/auth";

import {
  getMyProfile,
  listMyOrders,
  updateMyProfile,
} from "@/lib/account.functions";

const title = "My Account — PasarPilih";
const description =
  "Sign in or create a PasarPilih account to manage your profile, follow your orders and keep your shopping preferences in one place.";

const searchSchema = z.object({
  mode: z.enum(["signin", "register"]).optional(),
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  name: z.string().trim().max(80, "Name is too long").optional(),
});

export const Route = createFileRoute("/account")({
  validateSearch: searchSchema,
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
  component: AccountPage,
});

function AccountPage() {
  const search = Route.useSearch();
  const { loading, user } = useAuth();
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          My account
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage your profile, orders and preferences in one place.
        </p>

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your account…
          </div>
        ) : user ? (
          <SignedInView />
        ) : (
          <AuthForms initialMode={search.mode ?? "signin"} />
        )}
      </main>

      <Footer />
    </div>
  );
}

function AuthForms({ initialMode }: { initialMode: "signin" | "register" }) {
  const [mode, setMode] = useState<"signin" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);


  useEffect(() => setMode(initialMode), [initialMode]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password, name });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Signed in");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin + "/account",
            data: { display_name: parsed.data.name ?? "" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSentConfirmation(true);
          toast.success("Check your inbox to confirm your email");
        } else {
          toast.success("Welcome to PasarPilih!");
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong. Try again.";
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
        toast.error("Google sign-in failed. Please try again.");
        return;
      }
    } catch {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="inline-flex rounded-full bg-secondary p-1">
          {(["signin", "register"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setErrors({});
                setSentConfirmation(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                mode === value
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "signin" ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {value === "signin" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>

        {sentConfirmation ? (
          <div className="mt-6 rounded-xl border border-border bg-secondary/60 p-4 text-sm text-muted-foreground">
            <Mail className="mb-2 h-5 w-5 text-primary" />
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
            Open it to activate your account, then sign in here.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Budi Santoso"
                  autoComplete="name"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        )}

        {mode === "signin" && !sentConfirmation && (
          <div className="mt-4">
            {resetSent ? (
              <p className="rounded-xl border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
                <KeyRound className="mb-1 h-4 w-4 text-primary" />
                We emailed a password reset link to{" "}
                <strong className="text-foreground">{email}</strong>. Open it on this device to set
                a new password.
              </p>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const parsed = credentialsSchema.shape.email.safeParse(email);
                  if (!parsed.success) {
                    setErrors({ email: "Enter your email first, then request a reset link" });
                    return;
                  }
                  setResetBusy(true);
                  try {
                    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
                      redirectTo: window.location.origin + "/reset-password",
                    });
                    if (error) throw error;
                    setResetSent(true);
                    toast.success("Password reset link sent");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Could not send the reset link",
                    );
                  } finally {
                    setResetBusy(false);
                  }
                }}
                disabled={resetBusy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
              >
                {resetBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Forgot your password?
              </button>
            )}
          </div>
        )}


        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={googleBusy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {googleBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleGlyph />
          )}
          Continue with Google
        </button>
      </div>

      <GuestShortcuts />
    </div>
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

function GuestShortcuts() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-primary">
            <Truck className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold text-foreground">Guest order tracking</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          No account? You can still follow a shipment with your order number.
        </p>
        <Link
          to="/track"
          className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
        >
          Track an order
        </Link>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-primary">
            <Heart className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold text-foreground">Why register?</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Keep all your orders in one place and get status updates by email.
        </p>
      </div>
    </div>
  );
}

const statusTone: Record<string, string> = {
  delivered: "bg-chart-2/15 text-chart-2",
  shipped: "bg-primary/10 text-primary",
  "in transit": "bg-primary/10 text-primary",
  processing: "bg-chart-4/15 text-chart-4",
};

function SignedInView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchOrders = useServerFn(listMyOrders);
  const saveProfile = useServerFn(updateMyProfile);

  const profileQuery = useQuery({
    queryKey: ["account", "profile"],
    queryFn: () => fetchProfile(),
  });
  const ordersQuery = useQuery({
    queryKey: ["account", "orders"],
    queryFn: () => fetchOrders(),
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

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
      toast.success("Profile saved");
    },
    onError: () => toast.error("Could not save your profile. Please try again."),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  }

  const label = profileQuery.data?.display_name || displayNameFor(user);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
              {initialsFor(label)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ display_name: name.trim(), phone: phone.trim() });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={name}
                onChange={(e) => {
                  setTouched(true);
                  setName(e.target.value);
                }}
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => {
                  setTouched(true);
                  setPhone(e.target.value);
                }}
                placeholder="+62 812 3456 7890"
                maxLength={30}
              />
            </div>
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save profile
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <Link
            to="/unsubscribe"
            className="flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            Email notification settings
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {user && !user.email_confirmed_at && user.email && (
          <ResendVerification email={user.email} />
        )}


        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6" id="orders">

        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">My orders</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Orders placed with {user?.email}.
        </p>

        {ordersQuery.isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading orders…
          </div>
        ) : ordersQuery.isError ? (
          <p className="mt-6 text-sm text-destructive">
            We couldn't load your orders right now. Please refresh and try again.
          </p>
        ) : (ordersQuery.data?.length ?? 0) === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium text-foreground">No orders yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Orders made with this email will appear here automatically.
            </p>
            <Link
              to="/"
              className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {ordersQuery.data!.map((order) => (
              <li key={order.order_number} className="flex flex-wrap gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {order.product_name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {order.order_number} · Qty {order.quantity}
                    {order.courier ? ` · ${order.courier}` : ""}
                    {order.eta_date ? ` · ETA ${order.eta_date}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    className={`border-0 capitalize ${
                      statusTone[order.status.toLowerCase()] ?? "bg-secondary text-foreground"
                    }`}
                  >
                    {order.status}
                  </Badge>
                  <Link
                    to="/orders/$orderNumber"
                    params={{ orderNumber: order.order_number }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Details
                  </Link>
                  <Link
                    to="/track"
                    search={{ order: order.order_number }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Track
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>

        <AddressBook />
      </div>

    </div>
  );
}
