// apps/web/src/lib/offline/ping-queue.ts
import { BACKGROUND_SYNC_TAG } from "@/lib/config/ping";
import { publicEnv } from "@/lib/config/public";
import { pointEwkt, roundCoord } from "@/lib/geo/ewkt";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { GeoFix } from "@/lib/tourist/schemas";
import {
  allQueuedPings,
  deleteQueuedPing,
  enqueuePing,
  queuedPingCount,
  type QueuedPing,
} from "@/lib/offline/db";

type PingInsert = {
  tourist_id: string;
  geog: string;
  accuracy_m: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  battery_pct: number | null;
  source: "phone" | "manual";
  recorded_at: string;
};

function toInsert(ping: QueuedPing): PingInsert {
  return {
    tourist_id: ping.tourist_id,
    geog: pointEwkt(roundCoord(ping.lon), roundCoord(ping.lat)),
    accuracy_m: ping.accuracy_m,
    altitude_m: ping.altitude_m,
    speed_mps: ping.speed_mps,
    heading_deg: ping.heading_deg,
    battery_pct: ping.battery_pct,
    source: ping.source,
    recorded_at: ping.recorded_at,
  };
}

async function currentAccessToken(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function persistPing(
  touristId: string,
  fix: GeoFix,
  source: "phone" | "manual" = "phone",
): Promise<"sent" | "queued"> {
  const row: PingInsert = {
    tourist_id: touristId,
    geog: pointEwkt(roundCoord(fix.lon), roundCoord(fix.lat)),
    accuracy_m: fix.accuracy_m,
    altitude_m: fix.altitude_m,
    speed_mps: fix.speed_mps,
    heading_deg: fix.heading_deg,
    battery_pct: fix.battery_pct,
    source,
    recorded_at: fix.recorded_at,
  };

  const supabase = getBrowserSupabase();
  if (supabase && navigator.onLine) {
    const { error } = await supabase.from("location_pings").insert(row);
    if (!error) return "sent";
  }

  const token = await currentAccessToken();
  const queued: QueuedPing = {
    ...fix,
    id: crypto.randomUUID(),
    tourist_id: touristId,
    source,
    access_token: token ?? "",
    supabase_url: publicEnv.supabaseUrl ?? "",
    supabase_anon_key: publicEnv.supabaseAnonKey ?? "",
  };
  await enqueuePing(queued);
  await registerPingSync();
  return "queued";
}

export async function flushPingQueue(): Promise<{ flushed: number; remaining: number }> {
  const pending = await allQueuedPings();
  let flushed = 0;
  const supabase = getBrowserSupabase();
  const token = await currentAccessToken();

  for (const ping of pending) {
    let ok = false;
    if (supabase) {
      const { error } = await supabase.from("location_pings").insert(toInsert(ping));
      ok = !error;
    }
    if (!ok && ping.supabase_url && ping.supabase_anon_key) {
      const auth = token || ping.access_token;
      if (auth) {
        try {
          const res = await fetch(`${ping.supabase_url}/rest/v1/location_pings`, {
            method: "POST",
            headers: {
              apikey: ping.supabase_anon_key,
              Authorization: `Bearer ${auth}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(toInsert(ping)),
          });
          ok = res.ok || res.status === 409;
        } catch {
          ok = false;
        }
      }
    }
    if (ok) {
      await deleteQueuedPing(ping.id);
      flushed += 1;
    }
  }

  return { flushed, remaining: await queuedPingCount() };
}

export async function registerPingSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.sync) {
      await reg.sync.register(BACKGROUND_SYNC_TAG);
    }
  } catch {
    // Background Sync is Chromium-only; flush-on-reconnect still covers Safari.
  }
}
