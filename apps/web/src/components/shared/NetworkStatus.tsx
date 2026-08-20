"use client";

import { cn } from "@/lib/utils";

export type NetworkMode = "online" | "syncing" | "offline";

export function networkMode(online: boolean, queueDepth = 0): NetworkMode {
  if (!online) return "offline";
  if (queueDepth > 0) return "syncing";
  return "online";
}

const COPY: Record<
  NetworkMode,
  { kicker: string; body: string }
> = {
  online: {
    kicker: "Online",
    body: "Location is syncing with the control room.",
  },
  syncing: {
    kicker: "Syncing",
    body: "Queued location updates will send when the network is ready.",
  },
  offline: {
    kicker: "Offline mode",
    body: "Your safety tools remain available. Location will sync when connected.",
  },
};

export function NetworkStatus({
  online,
  queueDepth = 0,
  lastSynced,
  compact = false,
  className,
}: {
  online: boolean;
  queueDepth?: number;
  lastSynced?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const mode = networkMode(online, queueDepth);
  const copy = COPY[mode];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-start gap-2.5", className)}
    >
      <span
        className={cn(
          "mt-1.5 size-1.5 shrink-0 rounded-full",
          mode === "online" && "bg-success",
          mode === "syncing" && "bg-warning",
          mode === "offline" && "bg-muted-foreground",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="sts-kicker text-foreground">{copy.kicker}</p>
        {compact ? null : (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {copy.body}
            {lastSynced ? ` Last synced ${lastSynced}.` : ""}
          </p>
        )}
        {compact && lastSynced ? (
          <p className="sts-meta mt-0.5">Last synced {lastSynced}</p>
        ) : null}
      </div>
    </div>
  );
}
