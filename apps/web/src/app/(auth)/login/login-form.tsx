// apps/web/src/app/(auth)/login/login-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Mail, Shield, Smartphone } from "lucide-react";

import { completeSignIn, skipToApp } from "@/lib/auth/actions";
import {
  DEMO_OFFICER,
  DEMO_TOURIST,
  DEMO_TOURISTS,
  DEMO_TOURIST_DISPLAY_NAME,
  touristSubtitle,
  type DemoTourist,
} from "@/lib/auth/demo";
import { ensurePublicTouristSession } from "@/lib/auth/public-session";
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
  autoKyc?: boolean;
};

const MORE_TOURISTS = DEMO_TOURISTS.filter((tourist) => tourist.slug !== DEMO_TOURIST.slug);

export function LoginForm({
  defaultTab,
  initialError,
  autoSkip = false,
  autoKyc = false,
}: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const autoStarted = useRef(false);

  function finish(redirectTo: string) {
    router.push(redirectTo);
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

  function startKyc() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const session = await ensurePublicTouristSession("New traveller");
      if (!session.ok) {
        setError(session.message);
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

  function skipKyc() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const session = await ensurePublicTouristSession(DEMO_TOURIST_DISPLAY_NAME);
      if (!session.ok) {
        setError(session.message);
        return;
      }
      const result = await skipToApp();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      finish(result.redirectTo);
    });
  }

  function enterSeededTourist(tourist: DemoTourist) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const supabase = requireSupabase();
      if (!supabase) return;
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: tourist.email,
        password: tourist.password,
      });
      if (passwordError) {
        setError(`${passwordError.message} Seed tourists first (pnpm demo:reset).`);
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
        setError(`${passwordError.message} Seed the staff user (supabase db reset) first.`);
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

  useEffect(() => {
    if (autoStarted.current) return;
    if (autoKyc) {
      autoStarted.current = true;
      startKyc();
      return;
    }
    if (autoSkip) {
      autoStarted.current = true;
      skipKyc();
    }
    // Run once for /login?flow=kyc or /login?skip=1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKyc, autoSkip]);

  return (
    <Card className="sts-enter w-full max-w-md border-border/80 bg-card/80 shadow-2xl shadow-black/20 backdrop-blur-md">
      <CardHeader className="gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
          SIH 2025 · MDoNER
        </p>
        <CardTitle className="text-2xl tracking-tight">Sign in</CardTitle>
        <CardDescription>
          Issue an ID with KYC, skip to a scannable guest card, or enter as a seeded traveller.
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

        <Tabs defaultValue={defaultTab} className="w-full">
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
              <Button type="button" variant="outline" disabled={pending} onClick={startKyc}>
                {pending ? "Starting…" : "Issue ID with KYC"}
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={skipKyc}>
                {pending ? "Entering…" : "Skip — enter without KYC"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="tourist" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Anyone can mint a checkpoint ID. Complete Aadhaar (India) or passport (visitors), or
              skip and upgrade later.
            </p>
            <Button type="button" onClick={startKyc} disabled={pending} data-testid="start-kyc">
              {pending ? "Starting…" : "Issue ID with KYC"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={skipKyc}
              disabled={pending}
              data-testid="skip-onboarding"
            >
              {pending ? "Entering…" : "Skip — enter without KYC"}
            </Button>

            <div className="flex flex-col gap-2 pt-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Seeded traveller
              </p>
              <SeededTouristButton
                tourist={DEMO_TOURIST}
                pending={pending}
                onEnter={enterSeededTourist}
              />
              <details className="rounded-md border border-border/70 px-3 py-2" data-testid="more-travellers">
                <summary className="cursor-pointer text-sm font-medium">
                  More travellers
                </summary>
                <div className="mt-3 flex flex-col gap-2">
                  {MORE_TOURISTS.map((tourist) => (
                    <SeededTouristButton
                      key={tourist.slug}
                      tourist={tourist}
                      pending={pending}
                      onEnter={enterSeededTourist}
                    />
                  ))}
                </div>
              </details>
            </div>
          </TabsContent>

          <TabsContent value="officer" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Seeded control-room admin. Credentials:{" "}
              <span className="font-mono text-foreground">{DEMO_OFFICER.email}</span>
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

function SeededTouristButton({
  tourist,
  pending,
  onEnter,
}: {
  tourist: DemoTourist;
  pending: boolean;
  onEnter: (tourist: DemoTourist) => void;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => onEnter(tourist)}
      data-testid={`enter-tourist-${tourist.slug}`}
      className="h-auto w-full justify-start whitespace-normal py-2.5 text-left"
    >
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span>Enter as {tourist.label}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {touristSubtitle(tourist)}
        </span>
      </span>
    </Button>
  );
}
