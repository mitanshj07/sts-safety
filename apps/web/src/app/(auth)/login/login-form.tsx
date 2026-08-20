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

export function LoginForm({ defaultTab, initialError }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
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
    <Card className="sts-enter w-full max-w-md border-border/80 bg-card/80 shadow-2xl shadow-black/20 backdrop-blur-md">
      <CardHeader className="gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
          SIH 2025 · MDoNER
        </p>
        <CardTitle className="text-2xl tracking-tight">Sign in</CardTitle>
        <CardDescription>
          Indian travellers start with DigiLocker. Judges can skip to a seeded demo.
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
              <p className="text-xs text-muted-foreground">
                New tourist accounts open onboarding. Indians can fetch eAadhaar
                from the Tourist tab with DigiLocker instead.
              </p>
            </form>
          </TabsContent>

          <TabsContent value="tourist" className="mt-4 flex flex-col gap-3">
            <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Landmark className="size-4 text-primary" aria-hidden />
                DigiLocker
              </p>
              <p className="text-xs text-muted-foreground">
                Allow access once. We fetch eAadhaar (and issued DL / voter ID)
                and start onboarding with the fields filled in.
              </p>
              <Button
                type="button"
                className="w-full"
                data-testid="digilocker-signup"
                onClick={startDigilocker}
                disabled={pending}
              >
                Continue with DigiLocker
              </Button>
            </div>
            <p className="text-center text-[11px] tracking-wide text-muted-foreground uppercase">
              or demo shortcuts
            </p>
            <p className="text-sm text-muted-foreground">
              Seeded traveller{" "}
              <span className="font-mono text-foreground">{DEMO_TOURIST.email}</span>{" "}
              skips KYC. Anonymous guests land on onboarding.
            </p>
            <Button type="button" variant="outline" onClick={demoSeededTourist} disabled={pending}>
              {pending ? "Signing in…" : `Enter as ${DEMO_TOURIST.label}`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={demoTourist}
              disabled={pending}
            >
              {pending ? "Entering…" : "Anonymous demo tourist"}
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
