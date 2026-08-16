// apps/web/src/lib/geo/photon.ts
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import "server-only"

import { z } from "zod"

import { serverEnv } from "@/lib/env/server"
import { geohashEncode } from "@/lib/geo/geohash"
import { createAdminClient } from "@/lib/supabase/admin"

const photonSchema = z.object({
  features: z
    .array(
      z.object({
        properties: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
})

const nominatimSchema = z.object({
  display_name: z.string().optional(),
  name: z.string().optional(),
  address: z.record(z.string(), z.unknown()).optional(),
})

export type ReverseGeocodeResult = {
  address_text: string
  geohash: string
  provider: "cache" | "photon" | "nominatim" | "local-zones"
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function formatPhotonProps(props: Record<string, unknown>): string | null {
  const parts = [
    asNonEmptyString(props.name),
    asNonEmptyString(props.street),
    asNonEmptyString(props.housenumber),
    asNonEmptyString(props.city) ??
      asNonEmptyString(props.town) ??
      asNonEmptyString(props.village) ??
      asNonEmptyString(props.district),
    asNonEmptyString(props.county),
    asNonEmptyString(props.state),
    asNonEmptyString(props.country),
  ].filter((p): p is string => p !== null)
  const unique = [...new Set(parts)]
  return unique.length > 0 ? unique.join(", ") : null
}

type LocalZone = { name: string; risk: string; ring: number[][] }

let localZones: LocalZone[] | null | undefined

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0]
    const yi = ring[i]?.[1]
    const xj = ring[j]?.[0]
    const yj = ring[j]?.[1]
    if (xi === undefined || yi === undefined || xj === undefined || yj === undefined) continue
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function loadLocalZones(): LocalZone[] {
  if (localZones) return localZones
  const cwd = process.cwd()
  const candidates = [
    join(cwd, "public/offline/zones.geojson"),
    join(cwd, "apps/web/public/offline/zones.geojson"),
    resolve(cwd, "../../apps/web/public/offline/zones.geojson"),
  ]
  const path = candidates.find((p) => existsSync(p))
  if (!path) {
    localZones = []
    return localZones
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    features?: Array<{
      properties?: { name?: unknown; risk_level?: unknown }
      geometry?: { type?: string; coordinates?: unknown }
    }>
  }
  const zones: LocalZone[] = []
  for (const feature of parsed.features ?? []) {
    const name =
      typeof feature.properties?.name === "string" ? feature.properties.name : null
    if (!name) continue
    const coords = feature.geometry?.coordinates
    if (feature.geometry?.type !== "Polygon" || !Array.isArray(coords)) continue
    const ring = coords[0]
    if (!Array.isArray(ring)) continue
    const points: number[][] = []
    for (const pt of ring) {
      if (Array.isArray(pt) && typeof pt[0] === "number" && typeof pt[1] === "number") {
        points.push([pt[0], pt[1]])
      }
    }
    if (points.length >= 4) {
      zones.push({
        name,
        risk: typeof feature.properties?.risk_level === "string" ? feature.properties.risk_level : "info",
        ring: points,
      })
    }
  }
  localZones = zones
  return zones
}

function localZoneName(lat: number, lon: number): string | null {
  const hits = loadLocalZones().filter((z) => pointInRing(lon, lat, z.ring))
  if (hits.length === 0) return null
  const rank: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    info: 0,
  }
  hits.sort((a, b) => (rank[b.risk] ?? 0) - (rank[a.risk] ?? 0))
  return hits[0]?.name ?? null
}

function coordinateLabel(lat: number, lon: number): string {
  return `NE India · ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`
}

async function readCache(geohash: string): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("geocode_cache")
      .select("address_text")
      .eq("geohash", geohash)
      .maybeSingle()
    if (error || !data) return null
    return typeof data.address_text === "string" ? data.address_text : null
  } catch {
    return null
  }
}

async function writeCache(args: {
  geohash: string
  lat: number
  lon: number
  address_text: string
  provider: string
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from("geocode_cache").upsert(
      {
        geohash: args.geohash,
        lat: args.lat,
        lon: args.lon,
        address_text: args.address_text,
        provider: args.provider,
      },
      { onConflict: "geohash" },
    )
  } catch {
    // Cache is optional — reverse geocode must not fail the pipeline.
  }
}

async function fetchPhoton(lat: number, lon: number, timeoutMs: number): Promise<string | null> {
  const url = new URL(serverEnv.photonUrl)
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lon))
  const res = await fetch(url, {
    signal: AbortSignal.timeout(Math.max(200, timeoutMs)),
    headers: { "User-Agent": serverEnv.nominatimUserAgent },
  })
  if (!res.ok) return null
  const parsed = photonSchema.safeParse(await res.json())
  if (!parsed.success) return null
  const props = parsed.data.features?.[0]?.properties
  if (!props) return null
  return formatPhotonProps(props)
}

async function fetchNominatim(
  lat: number,
  lon: number,
  timeoutMs: number,
): Promise<string | null> {
  const url = new URL(serverEnv.nominatimUrl)
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lon))
  url.searchParams.set("format", "json")
  const res = await fetch(url, {
    signal: AbortSignal.timeout(Math.max(200, timeoutMs)),
    headers: { "User-Agent": serverEnv.nominatimUserAgent },
  })
  if (!res.ok) return null
  const parsed = nominatimSchema.safeParse(await res.json())
  if (!parsed.success) return null
  return (
    asNonEmptyString(parsed.data.display_name) ??
    asNonEmptyString(parsed.data.name)
  )
}

export async function reverseGeocode(args: {
  lat: number
  lon: number
  timeoutMs: number
}): Promise<ReverseGeocodeResult | null> {
  const geohash = geohashEncode(args.lat, args.lon)
  const cached = await readCache(geohash)
  if (cached) {
    return { address_text: cached, geohash, provider: "cache" }
  }

  const local = localZoneName(args.lat, args.lon)
  if (local) {
    await writeCache({
      geohash,
      lat: args.lat,
      lon: args.lon,
      address_text: local,
      provider: "local-zones",
    })
    return { address_text: local, geohash, provider: "local-zones" }
  }

  const remaining = args.timeoutMs
  try {
    const photon = await fetchPhoton(args.lat, args.lon, Math.min(2000, remaining))
    if (photon) {
      await writeCache({
        geohash,
        lat: args.lat,
        lon: args.lon,
        address_text: photon,
        provider: "photon",
      })
      return { address_text: photon, geohash, provider: "photon" }
    }
  } catch {
    // fall through to Nominatim
  }

  try {
    const nominatim = await fetchNominatim(
      args.lat,
      args.lon,
      Math.min(1500, Math.max(200, remaining - 500)),
    )
    if (nominatim) {
      await writeCache({
        geohash,
        lat: args.lat,
        lon: args.lon,
        address_text: nominatim,
        provider: "nominatim",
      })
      return { address_text: nominatim, geohash, provider: "nominatim" }
    }
  } catch {
    // coordinate fallback below
  }

  const fallback = coordinateLabel(args.lat, args.lon)
  return { address_text: fallback, geohash, provider: "local-zones" }
}
