// apps/web/src/components/tourist/TouristProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { COMMAND_NOTE_PROVIDER_REF, isCommandNoteNotification } from "@sts/shared";
import { useGeolocationTracker } from "@/hooks/useGeolocationTracker";
import { useLocalGeofence, type ZoneHit } from "@/hooks/useLocalGeofence";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { SOS_CADENCE_WINDOW_MS } from "@/lib/config/ping";
import { kvGet, kvSet, type CachedNotification, type ZoneCollection } from "@/lib/offline/db";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  loadCachedSession,
  loadLiveSession,
  saveSession,
  type TouristSession,
} from "@/lib/tourist/load-session";
import type { GeoFix } from "@/lib/tourist/schemas";
import type { TrackingStatus } from "@/hooks/useGeolocationTracker";

export type PermissionGate = {
  location: boolean;
  notifications: boolean;
};

type TouristRuntime = TouristSession & {
  online: boolean;
  tracking: TrackingStatus;
  lastFix: GeoFix | null;
  queueDepth: number;
  batteryPct: number | null;
  zones: ZoneCollection;
  currentZones: ZoneHit[];
  warning: ZoneHit | null;
  dismissWarning: () => void;
  permissions: PermissionGate;
  setPermissions: (next: PermissionGate) => void;
  markSos: () => void;
  refreshSession: () => Promise<void>;
  patchSession: (patch: Partial<TouristSession>) => Promise<void>;
};

const TouristContext = createContext<TouristRuntime | null>(null);

const DEFAULT_PERMS: PermissionGate = { location: false, notifications: false };

export function TouristProvider({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  const [session, setSession] = useState<TouristSession>({
    profileId: null,
    tourist: null,
    digitalId: null,
    itinerary: null,
    notifications: [],
  });
  const [permissions, setPermissionsState] = useState<PermissionGate>(DEFAULT_PERMS);

  useEffect(() => {
    void loadCachedSession().then(async (cached) => {
      setSession(cached);
      const stored = await kvGet<PermissionGate>("permissions");
      if (stored) setPermissionsState(stored);
    });
  }, []);

  const refreshSession = useCallback(async () => {
    const live = await loadLiveSession();
    setSession(live);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession, online]);

  const patchSession = useCallback(async (patch: Partial<TouristSession>) => {
    setSession((prev) => {
      const next = { ...prev, ...patch };
      void saveSession(next);
      return next;
    });
  }, []);

  const tracker = useGeolocationTracker({
    touristId: session.tourist?.id ?? null,
    enabled: permissions.location,
    online,
  });
  const geofence = useLocalGeofence(tracker.lastFix);
  usePushSubscription(permissions.notifications);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const touristId = session.tourist?.id;
    if (!supabase || !touristId) return;
    const channel = supabase
      .channel(`tourist:${touristId}`)
      .on("broadcast", { event: "incident" }, (message) => {
        const payload = (message as { payload?: Record<string, unknown> }).payload;
        if (payload?.kind === "note" && typeof payload.body === "string") {
          const incoming: CachedNotification = {
            id: `live-${Date.now()}`,
            title: typeof payload.title === "string" ? payload.title : "Control room",
            body: payload.body,
            channel: "realtime",
            status: "delivered",
            created_at: typeof payload.at === "string" ? payload.at : new Date().toISOString(),
            incident_id: typeof payload.incident_id === "string" ? payload.incident_id : null,
            provider_ref: COMMAND_NOTE_PROVIDER_REF,
          };
          if (isCommandNoteNotification(incoming)) {
            const voice = payload.message_kind === "voice";
            toast.message(incoming.title ?? "Control room", {
              description: voice ? "Voice note received" : (incoming.body ?? ""),
            });
          }
          setSession((prev) => {
            const already = prev.notifications.some(
              (row) =>
                isCommandNoteNotification(row) &&
                row.body === incoming.body &&
                (row.incident_id ?? "") === (incoming.incident_id ?? ""),
            );
            if (already) return prev;
            const next = {
              ...prev,
              notifications: [incoming, ...prev.notifications],
            };
            void saveSession(next);
            return next;
          });
          window.setTimeout(() => {
            void refreshSession();
          }, 800);
          return;
        }
        void refreshSession();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          void refreshSession();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session.tourist?.id, refreshSession]);

  const setPermissions = useCallback((next: PermissionGate) => {
    setPermissionsState(next);
    void kvSet("permissions", next);
  }, []);

  const markSos = useCallback(() => {
    const until = Date.now() + SOS_CADENCE_WINDOW_MS;
    void kvSet("sos_until", until);
    window.dispatchEvent(new CustomEvent("sts:sos", { detail: until }));
  }, []);

  const value = useMemo<TouristRuntime>(
    () => ({
      ...session,
      online,
      tracking: tracker.status,
      lastFix: tracker.lastFix,
      queueDepth: tracker.queueDepth,
      batteryPct: tracker.batteryPct,
      zones: geofence.zones,
      currentZones: geofence.currentZones,
      warning: geofence.warning,
      dismissWarning: geofence.dismissWarning,
      permissions,
      setPermissions,
      markSos,
      refreshSession,
      patchSession,
    }),
    [
      session,
      online,
      tracker.status,
      tracker.lastFix,
      tracker.queueDepth,
      tracker.batteryPct,
      geofence.zones,
      geofence.currentZones,
      geofence.warning,
      geofence.dismissWarning,
      permissions,
      setPermissions,
      markSos,
      refreshSession,
      patchSession,
    ],
  );

  return <TouristContext.Provider value={value}>{children}</TouristContext.Provider>;
}

export function useTouristRuntime(): TouristRuntime {
  const ctx = useContext(TouristContext);
  if (!ctx) {
    throw new Error("useTouristRuntime must be used within TouristProvider");
  }
  return ctx;
}
