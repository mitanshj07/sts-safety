// tools/simulator/src/features.ts
import {
  FEATURE_NAMES,
  STOP_EPS_M,
  STOP_MIN_DURATION_S,
  haversine,
  istHour,
  type FeatureVector,
} from "@sts/shared"
import { distanceToRingM, pointInRing } from "./geo.ts"
import { routeById } from "./routes/index.ts"
import type { PingSample, RouteId } from "./types.ts"
import { LOCAL_ZONES } from "./zones-local.ts"

const RISK_ORD: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}

function entropy(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  let h = 0
  for (const c of counts) {
    if (c <= 0) continue
    const p = c / total
    h -= p * Math.log2(p)
  }
  return h
}

function distToLine(lat: number, lon: number, routeId: RouteId): number {
  return distanceToRingM({ lat, lon }, routeById(routeId).profile.coords)
}

export function extractWindow(pings: PingSample[], routeId: RouteId): FeatureVector {
  const ordered = [...pings].sort((a, b) => a.simMs - b.simMs)
  const speeds = ordered.map((p) => p.speedMps)
  const accels: number[] = []
  const gaps: number[] = []
  const dBear: number[] = []
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1]
    const b = ordered[i]
    if (!a || !b) continue
    const dt = Math.max(0.001, (b.simMs - a.simMs) / 1000)
    accels.push((b.speedMps - a.speedMps) / dt)
    gaps.push(dt)
    let db = Math.abs(b.headingDeg - a.headingDeg)
    if (db > 180) db = 360 - db
    dBear.push(db)
  }

  const bins = [0, 0, 0, 0, 0, 0, 0, 0]
  for (const d of dBear) {
    const idx = Math.min(7, Math.floor(d / 22.5))
    const bin = bins[idx]
    if (bin !== undefined) bins[idx] = bin + 1
  }

  let stopCount = 0
  let stopDuration = 0
  let runStart: PingSample | null = null
  const close = (end: PingSample) => {
    if (!runStart) return
    const dur = (end.simMs - runStart.simMs) / 1000
    if (dur >= STOP_MIN_DURATION_S) {
      stopCount += 1
      stopDuration += dur
    }
    runStart = null
  }
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1]
    const b = ordered[i]
    if (!a || !b) continue
    const d = haversine({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon })
    if (d <= STOP_EPS_M) {
      if (!runStart) runStart = a
    } else {
      close(a)
    }
  }
  const last = ordered[ordered.length - 1]
  if (last) close(last)

  const first = ordered[0]
  const end = ordered[ordered.length - 1]
  const net =
    first && end ? haversine({ lat: first.lat, lon: first.lon }, { lat: end.lat, lon: end.lon }) : 0
  let gross = 0
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1]
    const b = ordered[i]
    if (!a || !b) continue
    gross += haversine({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon })
  }
  const centroid = {
    lat: mean(ordered.map((p) => p.lat)),
    lon: mean(ordered.map((p) => p.lon)),
  }
  const rg = Math.sqrt(
    mean(ordered.map((p) => haversine({ lat: p.lat, lon: p.lon }, centroid) ** 2)),
  )

  const night = mean(
    ordered.map((p) => {
      const hour = istHour(p.recordedAtIso)
      return hour >= 22 || hour < 5 ? 1 : 0
    }),
  )

  const riskDwell = mean(
    ordered.map((p) => {
      const hits = LOCAL_ZONES.filter((z) => pointInRing({ lat: p.lat, lon: p.lon }, z.ring))
      if (hits.length === 0) return 0
      return Math.max(...hits.map((z) => RISK_ORD[z.risk_level] ?? 0))
    }),
  )

  const itin = mean(ordered.map((p) => distToLine(p.lat, p.lon, routeId)))

  const batteries = ordered.map((p) => p.batteryPct)
  const tHours = ordered.map((p) => p.simMs / 3_600_000)
  let slope = 0
  if (ordered.length >= 2) {
    const tMean = mean(tHours)
    const bMean = mean(batteries)
    const den = tHours.reduce((a, t) => a + (t - tMean) ** 2, 0)
    const num = tHours.reduce((a, t, i) => a + (t - tMean) * ((batteries[i] ?? 0) - bMean), 0)
    slope = den === 0 ? 0 : num / den
  }

  const windowDurationS =
    first && end ? Math.max(0, (end.simMs - first.simMs) / 1000) : 0

  const round = (n: number) => Number(n.toFixed(6))
  return {
    speed_mean_mps: round(mean(speeds)),
    speed_std_mps: round(std(speeds)),
    speed_max_mps: round(speeds.length ? Math.max(...speeds) : 0),
    accel_std_mps2: round(std(accels)),
    bearing_change_entropy: round(entropy(bins)),
    stop_count: stopCount,
    stop_duration_s: round(stopDuration),
    itinerary_distance_m: round(itin),
    radius_of_gyration_m: round(rg),
    straightness_index: round(gross > 0 ? net / gross : 0),
    night_fraction: round(night),
    zone_risk_weighted_dwell: round(riskDwell),
    ping_gap_mean_s: round(mean(gaps)),
    ping_gap_max_s: round(gaps.length ? Math.max(...gaps) : 0),
    battery_slope_pct_per_h: round(slope),
    total_distance_m: round(gross),
    window_duration_s: round(windowDurationS),
    n_pings: ordered.length,
  }
}

export function vectorRow(v: FeatureVector): number[] {
  return FEATURE_NAMES.map((k) => v[k])
}
