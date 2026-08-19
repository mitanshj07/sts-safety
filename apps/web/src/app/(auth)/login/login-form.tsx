// apps/web/src/app/(auth)/login/login-form.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Mail, Shield, Smartphone } from "lucide-react";

import { completeSignIn, createGuestLogin, skipToApp } from "@/lib/auth/actions";
import { DEMO_OFFICER, DEMO_TOURIST, DEMO_TOURIST_DISPLAY_NAME } from "@/lib/auth/demo";
import { magicLinkSchema, type LoginTab } from "@/lib/auth/schemas";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LoginFormProps = {
  defaultTab: LoginTab;
  initialError: string | null;
  autoSkip?: boolean;
};

export function LoginForm({ defaultTab, initialError, autoSkip = false }: LoginFormProps) {
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const autoSkipStarted = useRef(false);

  function finish(redirectTo: string) {
    // Full navigation avoids the auth error boundary: router.push + refresh
    // re-renders /login while middleware redirects an authenticated session.
    window.location.assign(redirectTo);
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
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/callback`,
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
      const { data, error: anonError } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            display_name: DEMO_TOURIST_DISPLAY_NAME,
            role: "tourist",
          },
        },
      });
      if (anonError || !data.user) {
        const guest = await createGuestLogin();
        if (!guest.ok) {
          fail(guest.message);
          return;
        }
        const { error: passwordError } = await supabase.auth.signInWithPassword({
          email: guest.email,
          password: guest.password,
        });
        if (passwordError) {
          fail(passwordError.message);
          return;
        }
        const skipped = await skipToApp();
        if (!skipped.ok) {
          fail(skipped.message);
          return;
        }
        finish(skipped.redirectTo);
        return;
      }
      // Anonymous users have no email — provision profile + tourists row server-side.
      const result = await skipToApp();
      if (!result.ok) {
        fail(result.message);
        return;
      }
      finish(result.redirectTo);
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
      finish(result.redirectTo);
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
      finish(result.redirectTo);
    });
  }

  useEffect(() => {
    if (!autoSkip || autoSkipStarted.current) return;
    autoSkipStarted.current = true;
    demoTourist();
    // Run once for /login?skip=1 — demoTourist is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSkip]);

  return (
    <Card className="sts-enter w-full max-w-md border-border/80 bg-card/80 shadow-2xl shadow-black/20 backdrop-blur-md">
      <CardHeader className="gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
          SIH 2025 · MDoNER
        </p>
        <CardTitle className="text-2xl tracking-tight">Sign in</CardTitle>
        <CardDescription>
          Sign in, complete KYC, or skip straight to a scannable guest ID.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="magic" className="gap-1.5 text-xs sm:text-sm">
              <Mail className="size-3.5" />
              Magic link
            </TabsTrigger>
            <TabsTrigger value="tourist" className="gap-1.5 text-xs sm:text-sm">
              <Smartphone className="size-3.5" />
              Tourist
            </TabsTrigger>
            <TabsTrigger value="officer" className="gap-1.5 text-xs sm:text-sm">
              <Shield className="size-3.5" />
              Officer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="magic" className="mt-4">
            <form className="flex flex-col gap-3" onSubmit={sendMagicLink}>
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
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send magic link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={demoTourist}
              >
                {pending ? "Entering…" : "Skip — enter without KYC"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="tourist" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Seeded traveller{" "}
              <span className="font-mono text-foreground">{DEMO_TOURIST.email}</span>
              , or skip KYC and still get a scannable guest ID plus a North-East itinerary.
            </p>
            <Button type="button" onClick={demoSeededTourist} disabled={pending}>
              {pending ? "Signing in…" : `Enter as ${DEMO_TOURIST.label}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={demoTourist}
              disabled={pending}
              data-testid="skip-onboarding"
            >
              {pending ? "Entering…" : "Skip — enter without KYC"}
            </Button>
          </TabsContent>

          <TabsContent value="officer" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Seeded control-room admin. Credentials:{" "}
              <span className="font-mono text-foreground">
                {DEMO_OFFICER.email}
              </span>
            </p>
            <Button type="button" onClick={demoOfficer} disabled={pending}>
              {pending ? "Signing in…" : "Enter command centre"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
