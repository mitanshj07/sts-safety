// apps/web/src/app/(tourist)/sos/page.tsx
"use client";

import { PanicButton } from "@/components/tourist/PanicButton";
import { SosReplyThread } from "@/components/tourist/SosReplyThread";

export default function SosPage() {
  return (
    <main className="sts-enter relative mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center gap-6 overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.45_0.18_25_/_0.28),transparent_60%)]"
      />
      <div className="relative z-10 space-y-2 text-center">
        <p className="text-xs font-medium tracking-[0.28em] text-red-300/80 uppercase">
          Emergency
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">SOS</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
          Hold the button. An incident is written directly to Postgres (RLS). If that fails,
          your phone opens an SMS with the last coordinates.
        </p>
      </div>
      <div className="relative z-10">
        <PanicButton />
      </div>
      <div className="relative z-10 w-full max-w-sm">
        <SosReplyThread />
      </div>
    </main>
  );
}
