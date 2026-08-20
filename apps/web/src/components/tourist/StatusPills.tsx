// apps/web/src/components/tourist/StatusPills.tsx
"use client";

import { NetworkStatus } from "@/components/shared/NetworkStatus";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { formatIst } from "@/lib/ui/format";

export function StatusPills() {
  const { online, tracking, queueDepth, batteryPct, lastFix } = useTouristRuntime();

  return (
    <div className="flex flex-col gap-2">
      <NetworkStatus
        online={online}
        queueDepth={queueDepth}
        lastSynced={lastFix ? formatIst(lastFix.recorded_at) : null}
        compact
      />
      <p className="sts-meta">
        {tracking === "active"
          ? "GPS tracking"
          : tracking === "denied"
            ? "GPS denied"
            : tracking === "prompt"
              ? "Waiting for GPS"
              : tracking === "error"
                ? "GPS error — last known location kept locally"
                : "GPS idle"}
        {batteryPct !== null ? ` · ${batteryPct}%` : ""}
      </p>
    </div>
  );
}
