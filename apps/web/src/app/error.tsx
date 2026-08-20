// apps/web/src/app/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

import { AppMark } from "@/components/shared/AppMark";
import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/observability/sentry";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "root" });
  }, [error]);

  return (
    <main className="relative mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-3 px-6">
      <AppMark />
      <p className="sts-kicker">Recoverable error</p>
      <h1 className="text-2xl font-semibold tracking-tight">This screen failed to render</h1>
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        You are still safe to use SOS and the control room. Alerts still fire in Postgres. Retry
        this page or open a known route.
        {error.digest ? ` (${error.digest})` : ""}
      </p>
      <div className="mt-2 flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Retry
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Command centre</Link>
        </Button>
      </div>
    </main>
  );
}
