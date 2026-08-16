// apps/web/src/lib/config/public.ts
// Browser-safe reads of NEXT_PUBLIC_* only. Never import server secrets here.
// Access must be static (`process.env.NEXT_PUBLIC_FOO`) so Next.js inlines
// the values into the client bundle. Dynamic `process.env[name]` is undefined
// in the browser.

function trimEnv(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseLonLat(raw: string | undefined, fallback: [number, number]): [number, number] {
  if (!raw) return fallback;
  const parts = raw.split(",");
  const lon = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return fallback;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return fallback;
  return [lon, lat];
}

function parseZoom(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const publicEnv = {
  appName: trimEnv(process.env.NEXT_PUBLIC_APP_NAME) ?? "Smart Tourist Safety",
  appUrl: trimEnv(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000",
  supabaseUrl: trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  mapStyleUrl:
    trimEnv(process.env.NEXT_PUBLIC_MAP_STYLE_URL) ??
    "https://tiles.openfreemap.org/styles/liberty",
  mapStyleFallback:
    trimEnv(process.env.NEXT_PUBLIC_MAP_STYLE_FALLBACK) ??
    "https://tiles.openfreemap.org/styles/bright",
  pmtilesUrl:
    trimEnv(process.env.NEXT_PUBLIC_PMTILES_URL) ?? "/tiles/northeast.pmtiles",
  mapTileMode: trimEnv(process.env.NEXT_PUBLIC_MAP_TILE_MODE) ?? "openfreemap",
  mapDefaultCenter: parseLonLat(
    trimEnv(process.env.NEXT_PUBLIC_MAP_DEFAULT_CENTER),
    [91.7362, 26.1445],
  ),
  mapDefaultZoom: parseZoom(trimEnv(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM), 7),
  chainId: Number(trimEnv(process.env.NEXT_PUBLIC_CHAIN_ID) ?? "80002"),
  chainName: trimEnv(process.env.NEXT_PUBLIC_CHAIN_NAME) ?? "Polygon Amoy",
  blockExplorer:
    trimEnv(process.env.NEXT_PUBLIC_BLOCK_EXPLORER) ??
    "https://amoy.polygonscan.com",
  touristIdRegistry:
    trimEnv(process.env.NEXT_PUBLIC_TOURIST_ID_REGISTRY_ADDRESS) ??
    "0x0000000000000000000000000000000000000000",
  incidentAnchor:
    trimEnv(process.env.NEXT_PUBLIC_INCIDENT_ANCHOR_ADDRESS) ??
    "0x0000000000000000000000000000000000000000",
  vapidPublicKey: trimEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  sentryDsn: trimEnv(process.env.NEXT_PUBLIC_SENTRY_DSN),
} as const;

export type MapTileMode = "openfreemap" | "protomaps" | "pmtiles-local";

export function mapTileMode(): MapTileMode {
  const mode = publicEnv.mapTileMode;
  if (mode === "protomaps" || mode === "pmtiles-local") return mode;
  return "openfreemap";
}
