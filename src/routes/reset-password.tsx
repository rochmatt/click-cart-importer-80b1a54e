import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const title = "Reset your password — PasarPilih";
const description =
  "Choose a new password for your PasarPilih account after opening the recovery link we emailed you.";

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

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session || isRecovery) setReady(true);
      else setReady(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Password updated. You are signed in.");
      navigate({ to: "/account", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground">
          <KeyRound className="h-5 w-5 text-primary" />
          Set a new password
        </h1>

        {ready ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </button>
          </form>
        ) : (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            This page needs a valid recovery link. Request a new one from the{" "}
            <Link to="/account" className="font-semibold text-primary hover:underline">
              sign-in page
            </Link>{" "}
            and open the link from your email on this device.
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
