// apps/web/src/lib/config/ping.ts
// Mirrors .env.example tunables. Those vars are server-only, so the PWA uses
// the documented defaults (the Postgres engine still honours the real env).

export const PING_INTERVAL_MOVING_MS = 5_000;
export const PING_INTERVAL_STATIONARY_MS = 30_000;
export const PING_INTERVAL_SOS_MS = 2_000;
export const SOS_CADENCE_WINDOW_MS = 30 * 60 * 1000;
export const ACCURACY_MAX_M = 100;
export const ACCURACY_GRACE_MS = 60_000;
export const MOVING_SPEED_MPS = 0.5;
export const ZONE_CACHE_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_ITINERARY_CORRIDOR_M = 2_000;
export const PING_QUEUE_STORE = "ping-queue";
export const OFFLINE_DB_NAME = "sts-tourist";
export const OFFLINE_DB_VERSION = 1;
export const BACKGROUND_SYNC_TAG = "sts-flush-pings";
