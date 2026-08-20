// apps/web/src/app/(auth)/login/login-form.tsx
"use client";

import { useState, useTransition } from "react";
import { Landmark, Mail, Shield, Smartphone } from "lucide-react";

import { completeSignIn } from "@/lib/auth/actions";
import { DEMO_OFFICER, DEMO_TOURIST, DEMO_TOURIST_DISPLAY_NAME } from "@/lib/auth/demo";
import {
  nextPathForRole,
  resolvePostAuthTarget,
  sanitizeNextPath,
} from "@/lib/auth/next-path";
import type { UserRole } from "@/lib/auth/roles";
import { magicLinkSchema, type LoginTab } from "@/lib/auth/schemas";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LoginFormProps = {
  defaultTab: LoginTab;
  initialError: string | null;
  initialInfo?: string | null;
};

function safeNextPath(): string | null {
  if (typeof window === "undefined") return null;
  return sanitizeNextPath(
    new URLSearchParams(window.location.search).get("next"),
  );
}

export function LoginForm({
  defaultTab,
  initialError,
  initialInfo,
}: LoginFormProps) {
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(initialInfo ?? null);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function finish(redirectTo: string, role: UserRole) {
    // Full navigation avoids the auth error boundary: router.push + refresh
    // re-renders /login while the request proxy redirects an authenticated session.
    const requested = nextPathForRole(safeNextPath(), role);
    window.location.assign(resolvePostAuthTarget(redirectTo, requested));
  }

  function fail(message: string) {
    setError(message);
  }

  function runAuth(work: () => Promise<void>) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        await work();
      } catch (err) {
        fail(err instanceof Error ? err.message : "Sign-in failed. Retry.");
      }
    });
  }

  function requireSupabase() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      fail(
        "This public deploy shows the product UI. Demo logins need the seeded Supabase project (local or cloud).",
      );
      return null;
    }
    return supabase;
  }

  function startDigilocker() {
    window.location.assign("/api/identity/digilocker/start?intent=signup");
  }

  function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) {
      fail("Enter a valid email address.");
      return;
    }
    runAuth(async () => {
      const supabase = requireSupabase();
      if (!supabase) return;
      const callback = new URL("/callback", window.location.origin);
      const next = safeNextPath();
      if (next) callback.searchParams.set("next", next);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: callback.toString(),
          data: { role: "tourist" },
        },
      });
      if (otpError) {
        fail(otpError.message);
        return;
      }
      setInfo("Check your inbox for the magic link. Local Inbucket: :54324.");
    });
  }

  function demoTourist() {
    runAuth(async () => {
      const supabase = requireSupabase();
      if (!supabase) return;
      const { error: anonError } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            display_name: DEMO_TOURIST_DISPLAY_NAME,
            role: "tourist",
          },
        },
      });
      if (anonError) {
        const guest = await fetch("/api/auth/guest", { method: "POST" });
        const json: unknown = await guest.json().catch(() => null);
        if (!guest.ok) {
          const rec = json && typeof json === "object" ? (json as { error?: unknown }) : null;
          fail(typeof rec?.error === "string" ? rec.error : anonError.message);
          return;
        }
      }
      const result = await completeSignIn();
      if (!result.ok) {
        window.location.assign("/onboard");
        return;
      }
      finish(result.redirectTo, result.role);
    });
  }

  function demoSeededTourist() {
    runAuth(async () => {
      const supabase = requireSupabase();
      if (!supabase) return;
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: DEMO_TOURIST.email,
        password: DEMO_TOURIST.password,
      });
      if (passwordError) {
        fail(`${passwordError.message} Seed tourists first (pnpm demo:reset).`);
        return;
      }
      const result = await completeSignIn();
      if (!result.ok) {
        fail(result.message);
        return;
      }
      finish(result.redirectTo, result.role);
    });
  }

  function demoOfficer() {
    runAuth(async () => {
      const supabase = requireSupabase();
      if (!supabase) return;
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: DEMO_OFFICER.email,
        password: DEMO_OFFICER.password,
      });
      if (passwordError) {
        fail(
          `${passwordError.message} Seed the staff user (supabase db reset) first.`,
        );
        return;
      }
      const result = await completeSignIn();
      if (!result.ok) {
        fail(result.message);
        return;
      }
      finish(result.redirectTo, result.role);
    });
  }

  return (
    <div className="sts-enter w-full max-w-md border border-border bg-surface p-6 shadow-sm sm:p-7">
      <div className="space-y-2">
        <p className="sts-kicker text-brand">SIH 2025 · MDoNER</p>
        <h2 className="text-2xl font-semibold tracking-tight">Enter the system</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Indian travellers start with DigiLocker. Demo paths are labelled — they are not live
          operations.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {info ? (
          <Alert>
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue={defaultTab || "magic"} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="magic" className="min-h-11 gap-1.5 text-xs sm:text-sm">
              <Mail className="size-3.5" />
              Magic
            </TabsTrigger>
            <TabsTrigger value="tourist" className="min-h-11 gap-1.5 text-xs sm:text-sm">
              <Smartphone className="size-3.5" />
              Tourist
            </TabsTrigger>
            <TabsTrigger value="officer" className="min-h-11 gap-1.5 text-xs sm:text-sm">
              <Shield className="size-3.5" />
              Officer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="magic" className="mt-5">
            <form className="flex flex-col gap-3" onSubmit={sendMagicLink}>
              <p className="text-sm text-muted-foreground">
                Email sign-in for issued accounts. New addresses start as tourists.
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <Button type="submit" disabled={pending} className="min-h-11">
                {pending ? "Sending…" : "Send magic link"}
              </Button>
              <p className="text-xs text-muted-foreground">
                New tourist accounts open onboarding. Indians can sign in with DigiLocker on the
                Tourist tab instead.
              </p>
            </form>
          </TabsContent>

          <TabsContent value="tourist" className="mt-5 flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">Tourist · DigiLocker / onboarding</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Official identity first. Demo shortcuts sit underneath, clearly labelled.
              </p>
            </div>
            <div className="space-y-2 border border-primary/30 bg-primary/5 px-3 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Landmark className="size-4 text-primary" aria-hidden />
                DigiLocker
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sign in to DigiLocker, allow access, and we fill eAadhaar, name, and date of birth
                on onboarding.
              </p>
              <Button
                type="button"
                className="min-h-11 w-full"
                data-testid="digilocker-signup"
                onClick={startDigilocker}
                disabled={pending}
              >
                Continue with DigiLocker
              </Button>
            </div>
            <p className="sts-kicker">Demo path</p>
            <p className="text-sm text-muted-foreground">
              Seeded traveller{" "}
              <span className="font-mono text-foreground">{DEMO_TOURIST.email}</span> skips KYC.
              Anonymous guests land on onboarding.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={demoSeededTourist}
              disabled={pending}
              className="min-h-11"
            >
              {pending ? "Signing in…" : `Enter as ${DEMO_TOURIST.label}`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={demoTourist}
              disabled={pending}
              className="min-h-11"
            >
              {pending ? "Entering…" : "Anonymous demo tourist"}
            </Button>
          </TabsContent>

          <TabsContent value="officer" className="mt-5 flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">Officer · Command access</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Seeded control-room admin.{" "}
                <span className="font-mono text-foreground">{DEMO_OFFICER.email}</span>
              </p>
            </div>
            <p className="sts-kicker">Demo path</p>
            <Button type="button" onClick={demoOfficer} disabled={pending} className="min-h-11">
              {pending ? "Signing in…" : "Enter command centre"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
