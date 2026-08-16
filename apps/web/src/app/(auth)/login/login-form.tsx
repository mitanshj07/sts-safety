// apps/web/src/app/(auth)/login/login-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail, Shield, Smartphone } from "lucide-react";

import { completeSignIn } from "@/lib/auth/actions";
import { DEMO_OFFICER, DEMO_TOURIST, DEMO_TOURIST_DISPLAY_NAME } from "@/lib/auth/demo";
import { magicLinkSchema, type LoginTab } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/client";
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

export function LoginForm({ defaultTab, initialError }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function finish(redirectTo: string) {
    router.push(redirectTo);
    router.refresh();
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
      const supabase = createClient();
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
      const supabase = createClient();
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
      // Anonymous users have no email — provision profile + tourists row server-side.
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
      const supabase = createClient();
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
      const supabase = createClient();
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
          Three ways in. Judges: use a demo button — do not wait for email.
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
            </form>
          </TabsContent>

          <TabsContent value="tourist" className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Seeded traveller{" "}
              <span className="font-mono text-foreground">{DEMO_TOURIST.email}</span>{" "}
              or an anonymous guest for a cold start.
            </p>
            <Button type="button" onClick={demoSeededTourist} disabled={pending}>
              {pending ? "Signing in…" : `Enter as ${DEMO_TOURIST.label}`}
            </Button>
            <Button
              type="button"
              variant="outline"
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
