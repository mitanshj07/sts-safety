// apps/web/src/hooks/useLocalGeofence.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { ZONE_CACHE_TTL_MS } from "@/lib/config/ping";
import { riskFromUnknown, type RiskLevel } from "@/lib/geo/risk-colors";
import { kvGet, kvSet, type ZoneCollection, type ZoneFeature } from "@/lib/offline/db";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isBreachZone, effectiveRisk } from "@/lib/tourist/time-windows";
import type { GeoFix } from "@/lib/tourist/schemas";

export type ZoneHit = {
  id: string;
  name: string;
  category: string;
  risk_level: RiskLevel;
  advisory_text: string | null;
};

const EMPTY: ZoneCollection = { type: "FeatureCollection", features: [] };

function isZoneCollection(value: unknown): value is ZoneCollection {
  if (!value || typeof value !== "object") return false;
  const rec = value as { type?: unknown; features?: unknown };
  return rec.type === "FeatureCollection" && Array.isArray(rec.features);
}

async function loadBundledZones(): Promise<ZoneCollection> {
  try {
    const res = await fetch("/offline/zones.geojson");
    if (!res.ok) return EMPTY;
    const json: unknown = await res.json();
    return isZoneCollection(json) ? json : EMPTY;
  } catch {
    return EMPTY;
  }
}

function featureAsPolygon(
  feature: ZoneFeature,
): Feature<Polygon | MultiPolygon> | null {
  if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
    return feature as Feature<Polygon | MultiPolygon>;
  }
  return null;
}

export function evaluateFix(
  fix: GeoFix,
  zones: ZoneCollection,
): { inside: ZoneHit[]; breaches: ZoneHit[] } {
  const pt: [number, number] = [fix.lon, fix.lat];
  const inside: ZoneHit[] = [];
  const breaches: ZoneHit[] = [];
  for (const feature of zones.features) {
    const poly = featureAsPolygon(feature);
    if (!poly) continue;
    if (!booleanPointInPolygon(pt, poly)) continue;
    const props = feature.properties;
    const risk = effectiveRisk(riskFromUnknown(props.risk_level), props.time_windows);
    const hit: ZoneHit = {
      id: props.id,
      name: props.name,
      category: props.category,
      risk_level: risk,
      advisory_text: props.advisory_text,
    };
    inside.push(hit);
    if (isBreachZone(hit.category, hit.risk_level)) breaches.push(hit);
  }
  return { inside, breaches };
}

export function useLocalGeofence(fix: GeoFix | null): {
  zones: ZoneCollection;
  currentZones: ZoneHit[];
  warning: ZoneHit | null;
  dismissWarning: () => void;
} {
  const [zones, setZones] = useState<ZoneCollection>(EMPTY);
  const [warning, setWarning] = useState<ZoneHit | null>(null);
  const lastBreachId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const cached = await kvGet<{ geojson: ZoneCollection; cachedAt: number }>("zones");
      if (cached && isZoneCollection(cached.geojson) && !cancelled) {
        setZones(cached.geojson);
      } else {
        const bundled = await loadBundledZones();
        if (!cancelled && bundled.features.length > 0) {
          setZones(bundled);
          await kvSet("zones", { geojson: bundled, cachedAt: Date.now() });
        }
      }
      await refreshFromNetwork();
    }

    async function refreshFromNetwork() {
      const supabase = getBrowserSupabase();
      if (!supabase || !navigator.onLine) return;
      const { data, error } = await supabase.rpc("zones_as_geojson");
      if (error || !isZoneCollection(data) || cancelled) return;
      setZones(data);
      await kvSet("zones", { geojson: data, cachedAt: Date.now() });
    }

    void hydrate();
    const timer = window.setInterval(() => {
      void refreshFromNetwork();
    }, ZONE_CACHE_TTL_MS);

    const supabase = getBrowserSupabase();
    const channel = supabase
      ?.channel("sts-zones")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zones" },
        () => {
          void refreshFromNetwork();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, []);

  const { currentZones, nextWarning } = useMemo(() => {
    if (!fix) return { currentZones: [] as ZoneHit[], nextWarning: null as ZoneHit | null };
    const { inside, breaches } = evaluateFix(fix, zones);
    const top = [...breaches].sort((a, b) => {
      const order: Record<RiskLevel, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        none: 4,
      };
      return order[a.risk_level] - order[b.risk_level];
    })[0];
    return { currentZones: inside, nextWarning: top ?? null };
  }, [fix, zones]);

  useEffect(() => {
    if (!nextWarning) {
      lastBreachId.current = null;
      return;
    }
    if (lastBreachId.current === nextWarning.id) return;
    lastBreachId.current = nextWarning.id;
    setWarning(nextWarning);
    if (navigator.vibrate) {
      navigator.vibrate([200, 80, 200, 80, 400]);
    }
  }, [nextWarning]);

  return {
    zones,
    currentZones,
    warning,
    dismissWarning: () => setWarning(null),
  };
}
