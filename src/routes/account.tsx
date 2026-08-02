import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Loader2, LogOut, Package, Settings } from "lucide-react";

import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountFooter } from "@/components/account/AccountFooter";
import { AddressBook } from "@/components/account/AddressBook";
import { AuthPanel } from "@/components/account/AuthPanel";
import { ResendVerification } from "@/components/account/ResendVerification";
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

const title = "Masuk atau Daftar Akun — PasarPilih";
const description =
  "Masuk atau buat akun PasarPilih untuk checkout lebih cepat, menyimpan alamat & wishlist, serta melacak status pesanan secara otomatis.";


const searchSchema = z.object({
  mode: z.enum(["signin", "register"]).optional(),
  // Same-origin relative path to return to after sign-in (e.g. the OAuth consent page).
  next: z
    .string()
    .refine((v) => v.startsWith("/") && !v.startsWith("//"))
    .optional()
    .catch(undefined),
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
  const isAuthScreen = !loading && !user;

  if (isAuthScreen) {
    return (
      <div className="min-h-screen bg-background font-sans antialiased">
        {/* Chrome hanya untuk desktop; mobile pakai layar penuh khusus */}
        <div className="hidden md:block">
          <AnnouncementBar />
          <Header query={query} onQueryChange={setQuery} />
        </div>

        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 md:min-h-0 md:py-12 lg:px-8">
          <div className="md:hidden">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke beranda
            </Link>
          </div>

          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {search.mode === "register" ? "Daftar akun" : "Masuk ke akun"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Masuk atau daftar untuk checkout lebih cepat dan melacak pesanan otomatis.
          </p>

          <AuthPanel initialMode={search.mode ?? "signin"} nextPath={search.next} />
        </main>

        <div className="hidden md:block">
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans antialiased">
      <AccountHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {user ? "Akun saya" : "Masuk ke akun"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {user
            ? "Kelola profil, pesanan, dan preferensi kamu di satu tempat."
            : "Masuk atau daftar untuk checkout lebih cepat dan melacak pesanan otomatis."}
        </p>

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat akun kamu…
          </div>
        ) : (
          <SignedInView />
        )}
      </main>

      <AccountFooter />
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
                    search={{ email: undefined }}
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
