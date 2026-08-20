// apps/web/src/app/(tourist)/sos/page.tsx
"use client";

import { PanicButton } from "@/components/tourist/PanicButton";
import { SosReplyThread } from "@/components/tourist/SosReplyThread";

export default function SosPage() {
  return (
    <main className="sts-enter relative mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center gap-6 overflow-hidden px-4 py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--sos)_22%,transparent),transparent_62%)]"
      />
      <div className="relative z-10 space-y-2 text-center">
        <p className="sts-kicker text-sos">Emergency</p>
        <h1 className="sts-display text-4xl">Hold to send SOS</h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
          The incident is written directly to Postgres. If that fails, your phone
          opens an SMS with the last coordinates.
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
