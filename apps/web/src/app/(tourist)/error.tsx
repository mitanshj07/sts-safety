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
    <main className="sts-enter mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-3 px-4">
      <p className="sts-kicker">Location update paused</p>
      <h1 className="text-xl font-semibold tracking-tight">This screen failed to load</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        You are still on this device. SOS remains available. Your last known location is stored
        locally and will sync when you are connected.
      </p>
      <div className="mt-2 flex gap-2">
        <Button type="button" className="min-h-11" onClick={() => reset()}>
          Retry
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/sos">Open SOS</Link>
        </Button>
      </div>
    </main>
  );
}
