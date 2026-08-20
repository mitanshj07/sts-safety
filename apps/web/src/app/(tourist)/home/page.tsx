// apps/web/src/app/(tourist)/home/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NetworkStatus } from "@/components/shared/NetworkStatus";
import { PanicButton } from "@/components/tourist/PanicButton";
import { SafetyScoreGauge } from "@/components/tourist/SafetyScoreGauge";
import { SosReplyThread } from "@/components/tourist/SosReplyThread";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { RISK_BANNER, RISK_LABEL, type RiskLevel } from "@/lib/geo/risk-colors";
import { formatCoord, formatIst, relativeTime } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

function trackingCopy(tracking: string): string {
  if (tracking === "active") return "GPS tracking";
  if (tracking === "denied") return "GPS denied";
  if (tracking === "prompt") return "Waiting for GPS";
  if (tracking === "error") return "GPS error — last known location kept locally";
  return "GPS idle";
}

export default function TouristHomePage() {
  const { tourist, currentZones, itinerary, lastFix, online, tracking, queueDepth } =
    useTouristRuntime();
  const zone = currentZones[0];
  const nextWp = itinerary?.waypoints.find((w) => !w.checked_in_at);
  const risk: RiskLevel = zone?.risk_level ?? "none";
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="sts-enter mx-auto flex max-w-lg flex-col px-4 pt-5 pb-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="sts-kicker">Current zone</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {tourist?.full_name?.split(" ")[0] ?? "Traveller"}
          </h1>
        </div>
        <Link
          href="/sos"
          className="inline-flex min-h-11 min-w-11 items-center justify-center border border-danger/40 px-3 text-xs font-semibold tracking-[0.16em] text-danger"
        >
          SOS
        </Link>
      </header>

      <section
        className={cn("mt-4 border px-4 py-4", RISK_BANNER[risk])}
        aria-live="polite"
      >
        <p className="sts-kicker text-current">{RISK_LABEL[risk]}</p>
        <p className="mt-2 text-2xl leading-tight font-semibold tracking-tight text-balance">
          {zone?.name ?? "Open corridor"}
        </p>
        <p className="mt-1 text-sm text-current/80">
          {zone?.advisory_text ??
            (zone
              ? `${zone.category.replaceAll("_", " ")} · ${zone.risk_level}`
              : "You are outside mapped restricted zones.")}
        </p>
        <div className="sts-meta mt-3 space-y-0.5 text-current/75">
          <p>
            {lastFix
              ? formatCoord(lastFix.lat, lastFix.lon)
              : "Waiting for a GPS fix"}
          </p>
          {lastFix ? <p>Updated {relativeTime(lastFix.recorded_at)}</p> : null}
          <p>{trackingCopy(tracking)}</p>
        </div>
      </section>

      <div className="mt-5 border-y border-border py-4">
        <NetworkStatus
          online={online}
          queueDepth={queueDepth}
          lastSynced={lastFix ? formatIst(lastFix.recorded_at) : null}
        />
      </div>

      <section className="mt-6 flex flex-col items-center">
        <PanicButton />
      </section>

      <section className="mt-8 border-t border-border pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="sts-kicker">Safety score</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Drops in high-risk zones or after a missed check-in.
            </p>
          </div>
        </div>
        <SafetyScoreGauge score={tourist?.safety_score ?? 100} compact className="mt-3" />
      </section>

      <Link
        href="/trip"
        className="mt-6 flex min-h-14 items-center gap-3 border-t border-border py-4 text-sm"
      >
        <span className="min-w-0 flex-1">
          <span className="sts-kicker block">Next waypoint</span>
          {nextWp ? (
            <span className="mt-1 block font-medium">
              {nextWp.name}
              {nextWp.checkin_required ? " · check-in required" : ""}
            </span>
          ) : (
            <span className="mt-1 block text-muted-foreground">
              {itinerary ? "All waypoints complete" : "No itinerary yet — finish onboarding"}
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      <SosReplyThread onlyWhenOpen className="mt-4" />
    </main>
  );
}
