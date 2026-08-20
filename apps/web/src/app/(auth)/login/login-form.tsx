// apps/web/src/app/(auth)/login/login-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail, Shield, Smartphone } from "lucide-react";

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
    <div className="sts-enter grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-lg lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden flex-col justify-between bg-elevated p-8 lg:flex">
        <div>
          <p className="sts-kicker text-primary">SIH 2025 · MDoNER</p>
          <h1 className="sts-display mt-4 text-4xl">Sign in to the safety stack.</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Judges: use a demo button. Do not wait for email. Live officers and
            travellers can still take a magic link.
          </p>
        </div>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="sts-kicker">Tourist demo</dt>
            <dd className="mt-1 font-mono text-xs">{DEMO_TOURIST.email}</dd>
          </div>
          <div>
            <dt className="sts-kicker">Command demo</dt>
            <dd className="mt-1 font-mono text-xs">{DEMO_OFFICER.email}</dd>
          </div>
        </dl>
      </aside>

      <div className="flex flex-col gap-5 p-6 sm:p-8">
        <div className="lg:hidden">
          <p className="sts-kicker text-primary">SIH 2025 · MDoNER</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Demo buttons for the pitch. Magic link for a real session.
          </p>
        </div>
        <h2 className="hidden text-xl font-semibold tracking-tight lg:block">Choose a way in</h2>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {info ? (
          <Alert variant="success">
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid h-11 w-full grid-cols-3">
            <TabsTrigger value="magic" className="gap-1.5 text-xs sm:text-sm">
              <Mail className="size-3.5" />
              Magic
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

          <TabsContent value="magic" className="mt-5">
            <form className="flex flex-col gap-4" onSubmit={sendMagicLink}>
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

          <TabsContent value="tourist" className="mt-5 flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
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

          <TabsContent value="officer" className="mt-5 flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Seeded control-room admin.{" "}
              <span className="font-mono text-foreground">{DEMO_OFFICER.email}</span>
            </p>
            <Button type="button" onClick={demoOfficer} disabled={pending}>
              {pending ? "Signing in…" : "Enter command centre"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
