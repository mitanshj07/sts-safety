// tools/simulator/src/emit.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { locationPingSchema } from "@sts/shared"
import type { PingSample, SosSample } from "./types.ts"

export function touristClient(url: string, anonKey: string, accessToken: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export function wktPoint(lat: number, lon: number): string {
  return `SRID=4326;POINT(${lon} ${lat})`
}

export async function emitPing(
  client: SupabaseClient,
  touristId: string,
  ping: PingSample,
  recordedAtIso: string,
): Promise<{ ok: boolean; message: string }> {
  const parsed = locationPingSchema.parse({
    tourist_id: touristId,
    lat: ping.lat,
    lon: ping.lon,
    accuracy_m: ping.accuracyM,
    speed_mps: ping.speedMps,
    heading_deg: ping.headingDeg,
    battery_pct: ping.batteryPct,
    source: "simulator",
    is_mock: false,
    recorded_at: recordedAtIso,
  })
  const { error } = await client.from("location_pings").insert({
    tourist_id: parsed.tourist_id,
    geog: wktPoint(parsed.lat, parsed.lon),
    accuracy_m: parsed.accuracy_m,
    speed_mps: parsed.speed_mps,
    heading_deg: parsed.heading_deg,
    battery_pct: parsed.battery_pct,
    source: parsed.source,
    is_mock: parsed.is_mock,
    recorded_at: parsed.recorded_at,
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: "ok" }
}

export async function emitSos(
  client: SupabaseClient,
  touristId: string,
  sos: SosSample,
  recordedAtIso: string,
): Promise<{ ok: boolean; message: string }> {
  const { error } = await client.from("incidents").insert({
    tourist_id: touristId,
    type: "sos",
    severity: "critical",
    detected_by: "device",
    geog: wktPoint(sos.lat, sos.lon),
    payload: { source: "simulator", scenario: "panic-sos" },
    occurred_at: recordedAtIso,
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: "ok" }
}

export async function readTouristState(
  client: SupabaseClient,
  touristId: string,
): Promise<{ score: number | null; zoneIds: string[] }> {
  const { data, error } = await client
    .from("tourists")
    .select("safety_score, current_zone_ids")
    .eq("id", touristId)
    .maybeSingle()
  if (error || !data) return { score: null, zoneIds: [] }
  const row = data as { safety_score: number | null; current_zone_ids: string[] | null }
  return { score: row.safety_score, zoneIds: row.current_zone_ids ?? [] }
}

export async function countIncidentsSince(
  admin: SupabaseClient,
  touristIds: string[],
  sinceIso: string,
): Promise<{ total: number; byType: Record<string, number> }> {
  if (touristIds.length === 0) return { total: 0, byType: {} }
  const { data, error } = await admin
    .from("incidents")
    .select("type")
    .in("tourist_id", touristIds)
    .gte("occurred_at", sinceIso)
  if (error || !data) return { total: 0, byType: {} }
  const byType: Record<string, number> = {}
  for (const row of data as { type: string }[]) {
    byType[row.type] = (byType[row.type] ?? 0) + 1
  }
  return { total: data.length, byType }
}
