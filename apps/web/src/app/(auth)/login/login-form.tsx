// apps/web/src/app/(auth)/login/login-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Landmark, Mail, Shield, Smartphone } from "lucide-react";

import { completeSignIn } from "@/lib/auth/actions";
import { DEMO_OFFICER, DEMO_TOURIST, DEMO_TOURIST_DISPLAY_NAME } from "@/lib/auth/demo";
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
  digilockerDemo?: boolean;
};

function safeNextPath(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/login") ||
    next.startsWith("/api")
  ) {
    return null;
  }
  return next;
}

export function LoginForm({
  defaultTab,
  initialError,
  initialInfo,
  digilockerDemo = false,
}: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(initialInfo ?? null);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function finish(redirectTo: string) {
    router.push(safeNextPath() ?? redirectTo);
    router.refresh();
  }

  function requireSupabase() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError(
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
    setError(null);
    setInfo(null);
    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) {
      setError("Enter a valid email address.");
      return;
    }
    startTransition(async () => {
      const supabase = requireSupabase();
      if (!supabase) return;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/callback`,
          data: { role: "tourist" },
        },
      });
      if (otpError) {
        setError(otpError.message);
        return;
      }
      setInfo("Check your inbox for the magic link. Local Inbucket: :54324.");
    });
  }

  function demoTourist() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const supabase = requireSupabase();
      if (!supabase) return;
      const { data, error: anonError } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            display_name: DEMO_TOURIST_DISPLAY_NAME,
            role: "tourist",
          },
        },
      });
      if (anonError) {
        setError(anonError.message);
        return;
      }
      if (data.user && (data.user.is_anonymous || !data.user.email)) {
        const result = await completeSignIn();
        if (!result.ok) {
          setError(result.message);
          return;
        }
        finish(result.redirectTo);
        return;
      }
      const result = await completeSignIn();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      finish(result.redirectTo);
    });
  }

  function demoSeededTourist() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const supabase = requireSupabase();
      if (!supabase) return;
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: DEMO_TOURIST.email,
        password: DEMO_TOURIST.password,
      });
      if (passwordError) {
        setError(
          `${passwordError.message} Seed tourists first (pnpm demo:reset).`,
        );
        return;
      }
      const result = await completeSignIn();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      finish(result.redirectTo);
    });
  }

  function demoOfficer() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const supabase = requireSupabase();
      if (!supabase) return;
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: DEMO_OFFICER.email,
        password: DEMO_OFFICER.password,
      });
      if (passwordError) {
        setError(
          `${passwordError.message} Seed the staff user (supabase db reset) first.`,
        );
        return;
      }
      const result = await completeSignIn();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      finish(result.redirectTo);
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

        <Tabs defaultValue={defaultTab} className="w-full">
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
                {digilockerDemo
                  ? "Local demo sandbox. Allow access to fetch sample eAadhaar, then onboarding opens with the fields filled in."
                  : "Sign in on DigiLocker (MeitY / meripehchaan.gov.in). After you allow access we fetch eAadhaar XML and issued DL / voter ID, then open onboarding with the fields filled in."}
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
