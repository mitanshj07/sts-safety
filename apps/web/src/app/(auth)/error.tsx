// apps/web/src/app/(auth)/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/observability/sentry";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "auth" });
  }, [error]);

  return (
    <main className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold">Sign-in failed to render</h1>
      <p className="text-sm text-muted-foreground">
        Retry this screen, continue if you already signed in, or return home.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Retry
        </Button>
        <Button asChild>
          <Link href="/home">Tourist home</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Command centre</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}
