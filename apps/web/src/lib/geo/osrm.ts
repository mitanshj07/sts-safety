// apps/web/src/lib/geo/osrm.ts
import "server-only"
import { haversine, type LonLat } from "@sts/shared"
import { serverEnv } from "@/lib/env/server"

const ROAD_FACTOR = 1.4
const FALLBACK_SPEED_MPS = 8.33 // 30 km/h urban NE roads

const osrmSchema = {
  parseDuration(payload: unknown): number | null {
    if (!payload || typeof payload !== "object") return null
    const rec = payload as { code?: unknown; routes?: unknown }
    if (rec.code !== "Ok" || !Array.isArray(rec.routes) || rec.routes.length === 0) {
      return null
    }
    const first = rec.routes[0]
    if (!first || typeof first !== "object") return null
    const duration = (first as { duration?: unknown }).duration
    return typeof duration === "number" && Number.isFinite(duration) ? duration : null
  },
}

export function haversineEtaSeconds(from: LonLat, to: LonLat): number {
  const metres = haversine(from, to) * ROAD_FACTOR
  return Math.max(30, Math.round(metres / FALLBACK_SPEED_MPS))
}

export async function etaSeconds(
  from: LonLat,
  to: LonLat,
): Promise<{ seconds: number; source: "osrm" | "haversine" }> {
  const fallback = haversineEtaSeconds(from, to)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)
  try {
    const url = `${serverEnv.osrmUrl}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "SmartTouristSafety/1.0" },
    })
    if (!res.ok) return { seconds: fallback, source: "haversine" }
    const duration = osrmSchema.parseDuration(await res.json())
    if (duration === null) return { seconds: fallback, source: "haversine" }
    return { seconds: Math.round(duration), source: "osrm" }
  } catch {
    return { seconds: fallback, source: "haversine" }
  } finally {
    clearTimeout(timer)
  }
}
