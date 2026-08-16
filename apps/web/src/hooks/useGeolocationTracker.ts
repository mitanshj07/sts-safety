// apps/web/src/hooks/useGeolocationTracker.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACCURACY_GRACE_MS,
  ACCURACY_MAX_M,
  MOVING_SPEED_MPS,
  PING_INTERVAL_MOVING_MS,
  PING_INTERVAL_SOS_MS,
  PING_INTERVAL_STATIONARY_MS,
  SOS_CADENCE_WINDOW_MS,
} from "@/lib/config/ping";
import { kvGet, kvSet, queuedPingCount } from "@/lib/offline/db";
import { flushPingQueue, persistPing } from "@/lib/offline/ping-queue";
import type { GeoFix } from "@/lib/tourist/schemas";

export type TrackingStatus = "idle" | "prompt" | "active" | "denied" | "error";

export type TrackerState = {
  status: TrackingStatus;
  lastFix: GeoFix | null;
  queueDepth: number;
  batteryPct: number | null;
};

function cadenceMs(speed: number | null, sosUntil: number): number {
  if (Date.now() < sosUntil) return PING_INTERVAL_SOS_MS;
  if ((speed ?? 0) > MOVING_SPEED_MPS) return PING_INTERVAL_MOVING_MS;
  return PING_INTERVAL_STATIONARY_MS;
}

async function readBatteryPct(): Promise<number | null> {
  if (!navigator.getBattery) return null;
  try {
    const battery = await navigator.getBattery();
    return Math.round(Math.min(1, Math.max(0, battery.level)) * 100);
  } catch {
    return null;
  }
}

function coordsToFix(
  coords: GeolocationCoordinates,
  recordedAt: string,
  batteryPct: number | null,
): GeoFix {
  return {
    lat: coords.latitude,
    lon: coords.longitude,
    accuracy_m: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
    altitude_m: coords.altitude,
    speed_mps: coords.speed,
    heading_deg: coords.heading,
    battery_pct: batteryPct,
    recorded_at: recordedAt,
  };
}

export function useGeolocationTracker(opts: {
  touristId: string | null;
  enabled: boolean;
  online: boolean;
}): TrackerState {
  const { touristId, enabled, online } = opts;
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [lastFix, setLastFix] = useState<GeoFix | null>(null);
  const [queueDepth, setQueueDepth] = useState(0);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);
  const pendingLowRef = useRef<{ fix: GeoFix; firstSeen: number } | null>(null);
  const sosUntilRef = useRef(0);
  const touristIdRef = useRef(touristId);
  touristIdRef.current = touristId;

  const refreshQueue = useCallback(async () => {
    setQueueDepth(await queuedPingCount());
  }, []);

  const acceptFix = useCallback(
    async (fix: GeoFix) => {
      setLastFix(fix);
      const interval = cadenceMs(fix.speed_mps, sosUntilRef.current);
      const now = Date.now();
      if (now - lastSentAtRef.current < interval) return;
      lastSentAtRef.current = now;
      const id = touristIdRef.current;
      if (!id) return;
      await persistPing(id, fix, "phone");
      await refreshQueue();
    },
    [refreshQueue],
  );

  useEffect(() => {
    void kvGet<number>("sos_until").then((v) => {
      if (typeof v === "number") sosUntilRef.current = v;
    });
    const onSos = (event: Event) => {
      const until =
        event instanceof CustomEvent && typeof event.detail === "number"
          ? event.detail
          : Date.now() + SOS_CADENCE_WINDOW_MS;
      sosUntilRef.current = until;
      void kvSet("sos_until", until);
    };
    window.addEventListener("sts:sos", onSos);
    return () => window.removeEventListener("sts:sos", onSos);
  }, []);

  useEffect(() => {
    if (!online) return;
    void flushPingQueue().then(() => refreshQueue());
  }, [online, refreshQueue]);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    setStatus("prompt");

    const onSuccess = (pos: GeolocationPosition) => {
      if (cancelled) return;
      setStatus("active");
      void readBatteryPct().then((pct) => {
        if (cancelled) return;
        setBatteryPct(pct);
        const fix = coordsToFix(pos.coords, new Date(pos.timestamp).toISOString(), pct);
        const accuracy = fix.accuracy_m ?? Infinity;
        if (accuracy <= ACCURACY_MAX_M) {
          pendingLowRef.current = null;
          void acceptFix(fix);
          return;
        }
        const now = Date.now();
        if (!pendingLowRef.current) {
          pendingLowRef.current = { fix, firstSeen: now };
          return;
        }
        if (accuracy < (pendingLowRef.current.fix.accuracy_m ?? Infinity)) {
          pendingLowRef.current = { fix, firstSeen: pendingLowRef.current.firstSeen };
        }
        if (now - pendingLowRef.current.firstSeen >= ACCURACY_GRACE_MS) {
          const fallback = pendingLowRef.current.fix;
          pendingLowRef.current = null;
          void acceptFix(fallback);
        }
      });
    };

    const onError = (err: GeolocationPositionError) => {
      if (cancelled) return;
      setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20_000,
    });

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, acceptFix]);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  return { status, lastFix, queueDepth, batteryPct };
}
