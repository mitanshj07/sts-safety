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
  const firstName = tourist?.full_name?.split(" ")[0] ?? "Traveller";

  return (
    <main className="sts-enter mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {greet}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{firstName}</h1>
        </div>
        <Link
          href="/sos"
          className="rounded-full border border-red-500/40 bg-red-950/40 px-3 py-1 text-xs font-semibold tracking-wide text-red-300"
        >
          SOS
        </Link>
      </header>

      {tourist?.kyc_status === "skipped" ? (
        <Link
          href="/onboard"
          className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
        >
          Guest ID is live at checkpoints. Complete Aadhaar (India) or passport (visitors) KYC anytime.
        </Link>
      ) : null}

      <StatusPills />

      <section className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm">
        <SafetyScoreGauge score={tourist?.safety_score ?? 100} />
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Score drops when you enter high-risk zones or miss a check-in.
        </p>
      </section>

      <div
        className={cn(
          "rounded-2xl px-4 py-3.5 text-sm shadow-sm",
          zone ? RISK_BANNER[zone.risk_level] : "border border-border/80 bg-card",
        )}
      >
        <p className="flex items-center gap-1.5 text-xs tracking-widest uppercase opacity-80">
          <MapPin className="size-3.5" />
          Current zone
        </p>
        {zone ? (
          <>
            <p className="mt-1 font-semibold">{zone.name}</p>
            <p className="opacity-90">
              {zone.advisory_text ?? `${zone.category} · ${zone.risk_level}`}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 font-medium">Open corridor</p>
            <p className="text-muted-foreground">
              {lastFix
                ? `${lastFix.lat.toFixed(5)}, ${lastFix.lon.toFixed(5)}`
                : "Waiting for a GPS fix"}
            </p>
          </>
        )}
      </div>

      <Link
        href="/trip"
        className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 px-4 py-3.5 text-sm shadow-sm transition-colors hover:bg-accent/40"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
          <Navigation className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs tracking-widest text-muted-foreground uppercase">
            Next waypoint
          </span>
          {nextWp ? (
            <span className="block truncate font-medium">
              {nextWp.name}
              {nextWp.checkin_required ? " · check-in required" : ""}
            </span>
          ) : (
            <span className="block text-muted-foreground">
              {itinerary ? "All waypoints complete" : "Pick a North-East itinerary on Trip"}
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      <PanicButton />
      <SosReplyThread onlyWhenOpen />
    </main>
  );
}
