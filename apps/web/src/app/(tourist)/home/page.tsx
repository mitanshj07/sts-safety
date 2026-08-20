// apps/web/src/app/(tourist)/home/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Navigation } from "lucide-react";
import { PanicButton } from "@/components/tourist/PanicButton";
import { SafetyScoreGauge } from "@/components/tourist/SafetyScoreGauge";
import { SosReplyThread } from "@/components/tourist/SosReplyThread";
import { StatusPills } from "@/components/tourist/StatusPills";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { RISK_BANNER } from "@/lib/geo/risk-colors";
import { cn } from "@/lib/utils";

function useGreeting(): string {
  const [text, setText] = useState("Welcome");
  useEffect(() => {
    const hour = new Date().getHours();
    setText(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);
  return text;
}

export default function TouristHomePage() {
  const { tourist, currentZones, itinerary, lastFix } = useTouristRuntime();
  const greet = useGreeting();
  const zone = currentZones[0];
  const nextWp = itinerary?.waypoints.find((w) => !w.checked_in_at);

  return (
    <main className="sts-enter mx-auto flex max-w-lg flex-col gap-5 px-4 py-5">
      <header>
        <p className="sts-kicker">{greet}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">You are covered</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hold SOS if you need help. Zone warnings fire on this device first.
        </p>
      </header>

      <StatusPills />

      <section
        className={cn(
          "rounded-xl px-4 py-4 text-sm shadow-sm",
          zone ? RISK_BANNER[zone.risk_level] : "sts-panel",
        )}
      >
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase opacity-80">
          <MapPin className="size-3.5" aria-hidden />
          Current zone
        </p>
        {zone ? (
          <>
            <p className="mt-1.5 text-lg font-semibold tracking-tight">{zone.name}</p>
            <p className="mt-0.5 opacity-90">
              {zone.advisory_text ?? `${zone.category} · ${zone.risk_level}`}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1.5 font-semibold">Open corridor</p>
            <p className="text-muted-foreground mt-0.5">
              {lastFix
                ? `${lastFix.lat.toFixed(5)}, ${lastFix.lon.toFixed(5)}`
                : "Waiting for a GPS fix"}
            </p>
          </>
        )}
      </section>

      <PanicButton />

      <section className="sts-panel p-4">
        <SafetyScoreGauge score={tourist?.safety_score ?? 100} />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Score drops in high-risk zones or after a missed check-in.
        </p>
      </section>

      <Link
        href="/trip"
        className="sts-panel flex items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-accent/60"
      >
        <span className="bg-primary/12 text-primary grid size-10 place-items-center rounded-xl">
          <Navigation className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="sts-kicker block">Next waypoint</span>
          {nextWp ? (
            <span className="mt-0.5 block truncate font-medium">
              {nextWp.name}
              {nextWp.checkin_required ? " · check-in required" : ""}
            </span>
          ) : (
            <span className="text-muted-foreground mt-0.5 block">
              {itinerary ? "All waypoints complete" : "No itinerary yet — finish onboarding"}
            </span>
          )}
        </span>
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </Link>

      <SosReplyThread onlyWhenOpen />
    </main>
  );
}
