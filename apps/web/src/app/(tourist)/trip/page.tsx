// apps/web/src/app/(tourist)/trip/page.tsx
"use client";

import { useState } from "react";
import { Check, MapPin } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Button } from "@/components/ui/button";
import { persistPing } from "@/lib/offline/ping-queue";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type { Waypoint } from "@/lib/tourist/routes";
import { cn } from "@/lib/utils";

export default function TripPage() {
  const { itinerary, tourist, lastFix, patchSession } = useTouristRuntime();
  const [busy, setBusy] = useState<number | null>(null);

  async function checkIn(index: number) {
    if (!itinerary) return;
    setBusy(index);
    const now = new Date().toISOString();
    const next: Waypoint[] = itinerary.waypoints.map((w, i) =>
      i === index
        ? {
            ...w,
            checked_in_at: now,
            checkin_lat: lastFix?.lat,
            checkin_lon: lastFix?.lon,
          }
        : w,
    );
    const updated = { ...itinerary, waypoints: next };
    await patchSession({ itinerary: updated });

    if (tourist?.id && lastFix) {
      await persistPing(tourist.id, lastFix, "manual");
    }

    const supabase = getBrowserSupabase();
    if (supabase && navigator.onLine) {
      await supabase
        .from("itineraries")
        .update({ waypoints: next as unknown as Json })
        .eq("id", itinerary.id);
    }
    setBusy(null);
  }

  if (!itinerary) {
    return (
      <main className="sts-enter mx-auto max-w-lg px-4 py-10">
        <EmptyState
          icon={MapPin}
          title="No itinerary cached"
          description="Finish onboarding or reconnect to sync your planned North-East route."
        />
      </main>
    );
  }

  const done = itinerary.waypoints.filter((w) => w.checked_in_at).length;

  return (
    <main className="sts-enter mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <PageHeader
        kicker="Itinerary"
        title={itinerary.title}
        description={`Corridor ±${itinerary.corridor_m} m · ${done}/${itinerary.waypoints.length} check-ins`}
        className="mb-0"
      />
      <ol className="relative space-y-0">
        {itinerary.waypoints.map((wp, i) => {
          const checked = Boolean(wp.checked_in_at);
          const last = i === itinerary.waypoints.length - 1;
          return (
            <li key={`${wp.name}-${i}`} className="relative flex gap-3 pb-5">
              {!last ? (
                <span
                  className={cn(
                    "absolute top-7 left-[11px] h-[calc(100%-0.5rem)] w-px",
                    checked ? "bg-primary/50" : "bg-border",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {checked ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <div className="min-w-0 flex-1 space-y-2 rounded-2xl border border-border/80 bg-card/70 p-3.5">
                <p className="font-medium">{wp.name}</p>
                <p className="text-xs text-muted-foreground">
                  {wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}
                  {wp.checkin_required ? " · check-in required" : ""}
                </p>
                {checked ? (
                  <p className="text-xs text-primary">
                    Checked in {new Date(wp.checked_in_at!).toLocaleString()}
                  </p>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy === i}
                    onClick={() => void checkIn(i)}
                  >
                    {busy === i ? "Saving…" : "Check in here"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
