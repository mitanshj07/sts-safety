// apps/web/src/app/(tourist)/trip/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Button } from "@/components/ui/button";
import { persistPing } from "@/lib/offline/ping-queue";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import {
  PRESET_NE_ROUTES,
  itineraryLineString,
  routeById,
  type Waypoint,
} from "@/lib/tourist/routes";
import { cn } from "@/lib/utils";

export default function TripPage() {
  const { itinerary, tourist, lastFix, patchSession, refreshSession } = useTouristRuntime();
  const [busy, setBusy] = useState<number | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeId, setRouteId] = useState(itinerary?.id ?? PRESET_NE_ROUTES[0]?.id ?? "ghy-shillong");
  const [error, setError] = useState<string | null>(null);

  async function applyRoute(id: string) {
    const route = routeById(id);
    if (!route) return;
    setSavingRoute(true);
    setError(null);
    try {
      const res = await fetch("/api/identity/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itineraryPresetId: route.id,
          itineraryTitle: route.title,
          itineraryGeoJSON: { type: "LineString", coordinates: route.coordinates },
          itineraryWaypoints: route.waypoints,
          corridorM: route.corridor_m,
          entryPoint: route.entry_point,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; itineraryId?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not save itinerary");
        return;
      }
      await patchSession({
        itinerary: {
          id: json.itineraryId ?? route.id,
          title: route.title,
          corridor_m: route.corridor_m,
          waypoints: route.waypoints.map((w) => ({ ...w })),
          starts_at: tourist?.trip_start ?? new Date().toISOString(),
          ends_at: tourist?.trip_end ?? new Date().toISOString(),
          geometry: itineraryLineString(route).geometry,
        },
      });
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save itinerary");
    } finally {
      setSavingRoute(false);
    }
  }

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
    if (supabase && navigator.onLine && /^[0-9a-f-]{36}$/i.test(itinerary.id)) {
      await supabase
        .from("itineraries")
        .update({ waypoints: next as unknown as Json })
        .eq("id", itinerary.id);
    }
    setBusy(null);
  }

  const picker = (
    <div className="space-y-2 rounded-2xl border border-border/80 bg-card/70 p-3.5">
      <label htmlFor="preset-route" className="text-xs tracking-widest text-muted-foreground uppercase">
        Choose a North-East route
      </label>
      <select
        id="preset-route"
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={routeId}
        onChange={(event) => setRouteId(event.target.value)}
      >
        {PRESET_NE_ROUTES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={savingRoute}
        onClick={() => void applyRoute(routeId)}
      >
        {savingRoute ? "Saving…" : itinerary ? "Switch route" : "Use this itinerary"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );

  if (!itinerary) {
    return (
      <main className="sts-enter mx-auto flex max-w-lg flex-col gap-5 px-4 py-10">
        <EmptyState
          icon={MapPin}
          title="Pick an itinerary"
          description="Choose a preset North-East corridor. Check-ins and geofence deviation use this route."
        />
        {picker}
        <p className="text-center text-xs text-muted-foreground">
          No login itinerary yet?{" "}
          <Link href="/onboard" className="text-primary underline">
            Issue an ID
          </Link>{" "}
          or skip KYC from login.
        </p>
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
      {picker}
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
