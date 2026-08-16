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
    <main className="sts-mesh relative mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <AppMark />
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Recoverable error
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">This screen failed to render</h1>
      <p className="text-sm text-muted-foreground text-pretty">
        Alerts still fire in Postgres. Open the dashboard or retry this page.
        {error.digest ? ` (${error.digest})` : ""}
      </p>
      <div className="flex gap-2">
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
