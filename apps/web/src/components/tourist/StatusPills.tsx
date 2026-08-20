// apps/web/src/components/tourist/StatusPills.tsx
"use client";

import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Badge } from "@/components/ui/badge";
import { LiveDot } from "@/components/shared/LiveDot";

export function StatusPills() {
  const { online, tracking, queueDepth, batteryPct } = useTouristRuntime();

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant={online ? "success" : "destructive"} className="gap-1.5">
        <LiveDot live={online} />
        {online ? "Online" : "Offline"}
      </Badge>
      <Badge variant={tracking === "active" ? "secondary" : "outline"}>
        {tracking === "active"
          ? "Tracking"
          : tracking === "denied"
            ? "GPS denied"
            : tracking === "prompt"
              ? "GPS…"
              : "GPS idle"}
      </Badge>
      {queueDepth > 0 ? (
        <Badge variant="warning">
          {queueDepth} ping{queueDepth === 1 ? "" : "s"} queued
        </Badge>
      ) : null}
      {batteryPct !== null ? (
        <Badge variant={batteryPct <= 10 ? "destructive" : "outline"}>{batteryPct}%</Badge>
      ) : null}
    </div>
  );
}
