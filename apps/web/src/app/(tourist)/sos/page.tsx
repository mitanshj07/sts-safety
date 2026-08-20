// apps/web/src/app/(tourist)/sos/page.tsx
"use client";

import { PanicButton } from "@/components/tourist/PanicButton";
import { SosReplyThread } from "@/components/tourist/SosReplyThread";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { NetworkStatus } from "@/components/shared/NetworkStatus";
import { formatCoord, formatIst } from "@/lib/ui/format";

export default function SosPage() {
  const { lastFix, online, queueDepth } = useTouristRuntime();

  return (
    <main className="sts-enter mx-auto flex min-h-[70dvh] max-w-lg flex-col px-4 py-8">
      <p className="sts-kicker text-danger">Emergency</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">SOS</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
        Hold the control. This alerts the responder network and shares your current location.
        An optional line and voice notes go to the control room after it lands.
      </p>

      <div className="mt-8 flex flex-1 flex-col items-center justify-center">
        <PanicButton />
      </div>

      <div className="mt-8 space-y-3 border-t border-border pt-5">
        <NetworkStatus
          online={online}
          queueDepth={queueDepth}
          lastSynced={lastFix ? formatIst(lastFix.recorded_at) : null}
          compact
        />
        {lastFix ? (
          <p className="sts-meta">Last fix {formatCoord(lastFix.lat, lastFix.lon)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Location update paused until GPS is available. Last known coordinates will be used if
            present.
          </p>
        )}
      </div>

      <div className="mt-8 w-full">
        <SosReplyThread />
      </div>
    </main>
  );
}
