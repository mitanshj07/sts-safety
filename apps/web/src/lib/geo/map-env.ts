// apps/web/src/lib/geo/map-env.ts
import { z } from "zod";

export const mapTileModeSchema = z.enum([
  "openfreemap",
  "protomaps",
  "pmtiles-local",
]);

export type MapTileMode = z.infer<typeof mapTileModeSchema>;

const lonSchema = z.number().gte(-180).lte(180);
const latSchema = z.number().gte(-90).lte(90);

const centerSchema = z
  .string()
  .transform((raw) => raw.split(",").map((part) => Number(part.trim())))
  .pipe(z.tuple([lonSchema, latSchema]));

const zoomSchema = z.coerce.number().gte(0).lte(22);

/** Guwahati — matches NEXT_PUBLIC_MAP_DEFAULT_CENTER in .env.example */
export const GUWAHATI_CENTER: [number, number] = [91.7362, 26.1445];
export const DEFAULT_MAP_ZOOM = 7;

export function readMapTileMode(): MapTileMode {
  const parsed = mapTileModeSchema.safeParse(
    process.env.NEXT_PUBLIC_MAP_TILE_MODE ?? "openfreemap",
  );
  return parsed.success ? parsed.data : "openfreemap";
}

export function readMapStyleUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
    "https://tiles.openfreemap.org/styles/liberty"
  );
}

export function readMapStyleFallbackUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_STYLE_FALLBACK ??
    "https://tiles.openfreemap.org/styles/bright"
  );
}

export function readPmtilesUrl(): string {
  return process.env.NEXT_PUBLIC_PMTILES_URL ?? "/tiles/northeast.pmtiles";
}

export function readDefaultCenter(): [number, number] {
  const parsed = centerSchema.safeParse(
    process.env.NEXT_PUBLIC_MAP_DEFAULT_CENTER ?? "91.7362,26.1445",
  );
  return parsed.success ? parsed.data : GUWAHATI_CENTER;
}

export function readDefaultZoom(): number {
  const parsed = zoomSchema.safeParse(
    process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM ?? "7",
  );
  return parsed.success ? parsed.data : DEFAULT_MAP_ZOOM;
}

export function resolvePublicUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  if (typeof window === "undefined") {
    return pathOrUrl;
  }
  return new URL(pathOrUrl, window.location.origin).href;
}
