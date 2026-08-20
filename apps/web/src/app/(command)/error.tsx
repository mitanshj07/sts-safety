// apps/web/src/app/(command)/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/observability/sentry";

export default function CommandError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "command" });
  }, [error]);

  return (
    <main className="sts-enter flex min-h-[50vh] flex-col justify-center gap-3 p-8">
      <p className="sts-kicker">Control room</p>
      <h1 className="text-xl font-semibold tracking-tight">Command view failed</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Realtime may still be live. Incidents continue to write in Postgres. Retry, or return to
        the queue.
      </p>
      <div className="mt-2 flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Retry
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
