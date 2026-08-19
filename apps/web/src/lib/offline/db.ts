// apps/web/src/lib/offline/db.ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  PING_QUEUE_STORE,
} from "@/lib/config/ping";
import type { GeoFix } from "@/lib/tourist/schemas";
import type { Waypoint } from "@/lib/tourist/routes";
import type { RiskLevel } from "@/lib/geo/risk-colors";

export type QueuedPing = GeoFix & {
  id: string;
  tourist_id: string;
  source: "phone" | "manual";
  access_token: string;
  supabase_url: string;
  supabase_anon_key: string;
};

export type CachedTourist = {
  id: string;
  profile_id: string | null;
  full_name: string;
  nationality: string;
  kyc_type: string;
  kyc_last4: string | null;
  kyc_status?: "skipped" | "pending" | "verified";
  photo_data_url: string | null;
  safety_score: number;
  trip_start: string;
  trip_end: string;
  phone_e164: string | null;
  email: string | null;
  emergency_contacts: unknown;
  current_zone_ids: string[];
  tracking_enabled: boolean;
};

export type CachedDigitalId = {
  id: string;
  tourist_id: string;
  chain_id: number;
  contract_address: string;
  token_id: string | null;
  vc_path: string | null;
  status: "pending" | "active" | "expired" | "revoked" | "suspended";
  issue_tx_hash: string | null;
  valid_from: string;
  valid_until: string;
  kyc_last4: string | null;
  kyc_type?: string | null;
  kyc_status?: "skipped" | "pending" | "verified";
  full_name: string;
  nationality: string;
  photo_data_url: string | null;
};

export type CachedItinerary = {
  id: string;
  title: string;
  corridor_m: number;
  waypoints: Waypoint[];
  starts_at: string;
  ends_at: string;
  geometry: GeoJSON.LineString;
};

export type CachedNotification = {
  id: number | string;
  title: string | null;
  body: string | null;
  channel: string;
  status: string;
  created_at: string;
  incident_id: string | null;
  provider_ref: string | null;
};

export type ZoneProperties = {
  id: string;
  name: string;
  category: string;
  risk_level: RiskLevel;
  advisory_text: string | null;
  time_windows: unknown;
  requires_permit: boolean;
};

export type ZoneFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, ZoneProperties>;
export type ZoneCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  ZoneProperties
>;

interface StsDb extends DBSchema {
  [PING_QUEUE_STORE]: {
    key: string;
    value: QueuedPing;
    indexes: { "by-recorded": string };
  };
  kv: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<StsDb>> | null = null;

export function openTouristDb(): Promise<IDBPDatabase<StsDb>> {
  if (!dbPromise) {
    dbPromise = openDB<StsDb>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PING_QUEUE_STORE)) {
          const store = db.createObjectStore(PING_QUEUE_STORE, { keyPath: "id" });
          store.createIndex("by-recorded", "recorded_at");
        }
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv");
        }
      },
    });
  }
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openTouristDb();
  return (await db.get("kv", key)) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openTouristDb();
  await db.put("kv", value, key);
}

export async function enqueuePing(ping: QueuedPing): Promise<void> {
  const db = await openTouristDb();
  await db.put(PING_QUEUE_STORE, ping);
}

export async function allQueuedPings(): Promise<QueuedPing[]> {
  const db = await openTouristDb();
  return db.getAllFromIndex(PING_QUEUE_STORE, "by-recorded");
}

export async function deleteQueuedPing(id: string): Promise<void> {
  const db = await openTouristDb();
  await db.delete(PING_QUEUE_STORE, id);
}

export async function queuedPingCount(): Promise<number> {
  const db = await openTouristDb();
  return db.count(PING_QUEUE_STORE);
}
