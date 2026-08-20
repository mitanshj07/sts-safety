// apps/web/src/app/(tourist)/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/observability/sentry";

export default function TouristError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "tourist" });
  }, [error]);

  return (
    <main className="sts-enter mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="sts-kicker">Tourist PWA</p>
      <h1 className="text-xl font-semibold tracking-tight">This screen failed</h1>
      <p className="text-sm text-muted-foreground">
        SOS still works from the panic button if this page recovers.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Retry
        </Button>
        <Button asChild variant="sos">
          <Link href="/sos">Open SOS</Link>
        </Button>
      </div>
    </main>
  );
}
