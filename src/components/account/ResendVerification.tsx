import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { resendVerification } from "@/lib/auth/auth.functions";

/** Cooldown per attempt (seconds): 60s, 2m, 5m, 15m, then 30m. */
const COOLDOWN_STEPS = [60, 120, 300, 900, 1800];
/** Max sends allowed inside the rolling window below. */
const MAX_SENDS_PER_WINDOW = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface ThrottleState {
  attempts: number[]; // epoch ms of recent sends
  nextAllowedAt: number; // epoch ms
}

const EMPTY: ThrottleState = { attempts: [], nextAllowedAt: 0 };

function storageKey(email: string) {
  return `pp:resend-verification:${email.toLowerCase()}`;
}

function readState(email: string): ThrottleState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey(email));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as ThrottleState;
    const cutoff = Date.now() - WINDOW_MS;
    return {
      attempts: (parsed.attempts ?? []).filter((t) => t > cutoff),
      nextAllowedAt: parsed.nextAllowedAt ?? 0,
    };
  } catch {
    return EMPTY;
  }
}

function writeState(email: string, state: ThrottleState) {
  try {
    window.localStorage.setItem(storageKey(email), JSON.stringify(state));
  } catch {
    /* storage unavailable — in-memory throttle still applies */
  }
}

function formatRemaining(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${mins}m ${rest}s` : `${mins}m`;
  }
  return `${seconds}s`;
}

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<ThrottleState>(EMPTY);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    setState(readState(email));
  }, [email]);

  // Tick down the visible cooldown once per second.
  useEffect(() => {
    function tick() {
      setRemaining(Math.max(0, Math.ceil((state.nextAllowedAt - Date.now()) / 1000)));
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [state.nextAllowedAt]);

  const recentAttempts = state.attempts.filter((t) => t > Date.now() - WINDOW_MS).length;
  const windowExhausted = recentAttempts >= MAX_SENDS_PER_WINDOW;
  const blocked = busy || remaining > 0 || windowExhausted;

  const onResend = useCallback(async () => {
    if (!email || inFlight.current) return;

    const current = readState(email);
    const now = Date.now();
    const attemptsInWindow = current.attempts.filter((t) => t > now - WINDOW_MS);

    if (current.nextAllowedAt > now) {
      const wait = Math.ceil((current.nextAllowedAt - now) / 1000);
      setState({ ...current, attempts: attemptsInWindow });
      toast.error(`Please wait ${formatRemaining(wait)} before requesting another email.`);
      return;
    }
    if (attemptsInWindow.length >= MAX_SENDS_PER_WINDOW) {
      setState({ ...current, attempts: attemptsInWindow });
      toast.error("Too many verification emails requested. Try again in about an hour.");
      return;
    }

    inFlight.current = true;
    setBusy(true);
    try {
      // Server sengaja selalu menjawab ok — termasuk saat akun tidak ada,
      // sudah terverifikasi, atau pembatas laju menolak — supaya tombol ini
      // tidak bisa dipakai memeriksa keberadaan akun. Pembatas di sisi klien
      // di bawah tetap ada demi kenyamanan, bukan sebagai penegakan.
      await resendVerification({ data: { email } });

      const step = COOLDOWN_STEPS[Math.min(attemptsInWindow.length, COOLDOWN_STEPS.length - 1)]!;
      const next: ThrottleState = {
        attempts: [...attemptsInWindow, Date.now()],
        nextAllowedAt: Date.now() + step * 1000,
      };
      setState(next);
      writeState(email, next);

      toast.success(
        `Verification email sent. You can request another in ${formatRemaining(step)}.`,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [email]);

  return (
    <div className="rounded-2xl border border-chart-4/40 bg-chart-4/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldAlert className="h-4 w-4 text-chart-4" />
        Confirm your email address
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        We sent a verification link to {email}. Confirm it to secure your account and receive
        order updates.
      </p>
      <button
        type="button"
        onClick={() => void onResend()}
        disabled={blocked}
        aria-live="polite"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {windowExhausted && remaining === 0
          ? "Resend limit reached — try again later"
          : remaining > 0
            ? `Resend available in ${formatRemaining(remaining)}`
            : "Resend verification email"}
      </button>
      {recentAttempts > 0 && !windowExhausted && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {MAX_SENDS_PER_WINDOW - recentAttempts} resend
          {MAX_SENDS_PER_WINDOW - recentAttempts === 1 ? "" : "s"} left this hour.
        </p>
      )}
    </div>
  );
}
