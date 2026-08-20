// apps/web/src/lib/ai/features.ts
import "server-only"

import { FEATURE_COUNT, FEATURE_NAMES } from "@sts/shared/constants/feature-vector"
import { bearing, computeSafetyScore, haversine, istHour, type RiskLevel } from "@sts/shared"

const STOP_EPS_M = 50
const STOP_MIN_DURATION_S = 60

export type ScorePing = {
  lat: number
  lon: number
  recorded_at: string
  speed_mps: number | null
  heading_deg: number | null
  battery_pct: number | null
  accuracy_m: number | null
}

export type ScoreItinerary = {
  coordinates: Array<[number, number]>
  corridor_m: number
  waypoints: Array<{ name: string; lat: number; lon: number }>
}

export type ScoreZone = {
  name: string
  category: string
  risk_level: RiskLevel
  geom: Array<Array<[number, number]>> | null
}

export type ExtractedWindow = {
  vector: number[]
  inAccommodation: boolean
  stopCount: number
  stopDurationS: number
}

const RISK_WEIGHT: Record<RiskLevel, number> = {
  none: 0,
  low: 0.25,
  medium: 0.5,
  high: 0.75,
  critical: 1,
}

const ENTROPY_BINS = 8
const STOP_MAX_SPEED_MPS = 1.5
const EARTH_RADIUS_M = 6_371_000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const varSum = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(varSum)
}

function shannonEntropyNorm(values: number[], lo: number, hi: number): number {
  if (values.length === 0) return 0
  const counts = new Array<number>(ENTROPY_BINS).fill(0)
  const span = hi - lo
  for (const v of values) {
    const t = Math.min(ENTROPY_BINS - 1, Math.max(0, Math.floor(((v - lo) / span) * ENTROPY_BINS)))
    const bucket = counts[t]
    if (bucket !== undefined) counts[t] = bucket + 1
  }
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  let ent = 0
  for (const c of counts) {
    if (c <= 0) continue
    const p = c / total
    ent -= p * Math.log2(p)
  }
  return ent / Math.log2(ENTROPY_BINS)
}

function rayIntersects(lon: number, lat: number, ring: Array<[number, number]>): boolean {
  let inside = false
  const n = ring.length
  if (n < 3) return false
  let j = n - 1
  for (let i = 0; i < n; i += 1) {
    const ri = ring[i]
    const rj = ring[j]
    if (!ri || !rj) {
      j = i
      continue
    }
    const xi = ri[0]
    const yi = ri[1]
    const xj = rj[0]
    const yj = rj[1]
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-18) + xi
    if (intersects) inside = !inside
    j = i
  }
  return inside
}

function pointInPolygon(lat: number, lon: number, rings: Array<Array<[number, number]>>): boolean {
  const exterior = rings[0]
  if (!exterior || !rayIntersects(lon, lat, exterior)) return false
  for (let i = 1; i < rings.length; i += 1) {
    const hole = rings[i]
    if (hole && rayIntersects(lon, lat, hole)) return false
  }
  return true
}

function localXy(
  lat: number,
  lon: number,
  lat0: number,
  lon0: number,
): { x: number; y: number } {
  return {
    x: EARTH_RADIUS_M * toRad(lon - lon0) * Math.cos(toRad(lat0)),
    y: EARTH_RADIUS_M * toRad(lat - lat0),
  }
}

function pointToSegmentM(
  lat: number,
  lon: number,
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const a = localXy(latA, lonA, lat, lon)
  const b = localXy(latB, lonB, lat, lon)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const denom = dx * dx + dy * dy
  if (denom <= 1e-12) {
    return haversine({ lat, lon }, { lat: latA, lon: lonA })
  }
  const t = Math.min(1, Math.max(0, (-a.x * dx + -a.y * dy) / denom))
  const cx = a.x + t * dx
  const cy = a.y + t * dy
  const latC = lat + toDeg(cy / EARTH_RADIUS_M)
  const cosLat = Math.cos(toRad(lat))
  const lonC =
    Math.abs(cosLat) < 1e-12 ? lon : lon + toDeg(cx / (EARTH_RADIUS_M * cosLat))
  return haversine({ lat, lon }, { lat: latC, lon: lonC })
}

function pointToLinestringM(
  lat: number,
  lon: number,
  coordinates: Array<[number, number]>,
): number {
  if (coordinates.length === 0) return 0
  const only = coordinates[0]
  if (coordinates.length === 1 && only) {
    return haversine({ lat, lon }, { lat: only[1], lon: only[0] })
  }
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const a = coordinates[i]
    const b = coordinates[i + 1]
    if (!a || !b) continue
    const d = pointToSegmentM(lat, lon, a[1], a[0], b[1], b[0])
    if (d < best) best = d
  }
  return Number.isFinite(best) ? best : 0
}

function maxZoneWeight(lat: number, lon: number, zones: ScoreZone[]): number {
  let best = 0
  for (const zone of zones) {
    if (!zone.geom || zone.geom.length === 0) continue
    if (pointInPolygon(lat, lon, zone.geom)) {
      const w = RISK_WEIGHT[zone.risk_level] ?? 0
      if (w > best) best = w
    }
  }
  return best
}

function detectStops(pings: ScorePing[]): { count: number; durationS: number; inAcc: boolean } {
  if (pings.length < 2) return { count: 0, durationS: 0, inAcc: false }
  let count = 0
  let durationS = 0
  let runStart = 0
  const flush = (end: number) => {
    const startPing = pings[runStart]
    const endPing = pings[end]
    if (!startPing || !endPing) return
    const dur =
      (Date.parse(endPing.recorded_at) - Date.parse(startPing.recorded_at)) / 1000
    if (dur >= STOP_MIN_DURATION_S) {
      count += 1
      durationS += dur
    }
  }
  for (let i = 1; i < pings.length; i += 1) {
    const prev = pings[i - 1]
    const cur = pings[i]
    if (!prev || !cur) continue
    const d = haversine(
      { lat: prev.lat, lon: prev.lon },
      { lat: cur.lat, lon: cur.lon },
    )
    const speed = cur.speed_mps ?? (d > 0 ? d / Math.max(1e-6, (Date.parse(cur.recorded_at) - Date.parse(prev.recorded_at)) / 1000) : 0)
    const stationary = d <= STOP_EPS_M && speed <= STOP_MAX_SPEED_MPS
    if (!stationary) {
      if (i - 1 > runStart) flush(i - 1)
      runStart = i
    }
  }
  if (pings.length - 1 > runStart) flush(pings.length - 1)
  return { count, durationS, inAcc: false }
}

export function extractFeatures(
  pings: ScorePing[],
  itinerary: ScoreItinerary | null,
  zones: ScoreZone[],
): ExtractedWindow {
  const ordered = [...pings].sort(
    (a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at),
  )
  const zeros = (): ExtractedWindow => ({
    vector: Array.from({ length: FEATURE_COUNT }, () => 0),
    inAccommodation: false,
    stopCount: 0,
    stopDurationS: 0,
  })
  if (ordered.length === 0) return zeros()

  const n = ordered.length
  const times = ordered.map((p) => Date.parse(p.recorded_at) / 1000)
  const t0 = times[0] ?? 0
  const tLast = times[times.length - 1] ?? t0
  const windowDurationS = Math.max(0, tLast - t0)
  const speeds: number[] = []
  const headings: number[] = []
  const segmentDist: number[] = []
  const accels: number[] = []
  const deltas: number[] = []

  for (let i = 0; i < n; i += 1) {
    const ping = ordered[i]
    if (!ping) continue
    const prev = i > 0 ? ordered[i - 1] : null
    const ti = times[i] ?? t0
    const tPrev = i > 0 ? (times[i - 1] ?? ti) : ti
    let speed = ping.speed_mps
    if (speed === null && prev) {
      const dt = Math.max(ti - tPrev, 1e-6)
      speed = haversine(
        { lat: prev.lat, lon: prev.lon },
        { lat: ping.lat, lon: ping.lon },
      ) / dt
    }
    speeds.push(speed ?? 0)
    if (prev) {
      const d = haversine(
        { lat: prev.lat, lon: prev.lon },
        { lat: ping.lat, lon: ping.lon },
      )
      segmentDist.push(d)
      const h =
        ping.heading_deg ??
        bearing(
          { lat: prev.lat, lon: prev.lon },
          { lat: ping.lat, lon: ping.lon },
        )
      headings.push(h)
      const prevH = headings[headings.length - 2] ?? h
      let delta = ((h - prevH + 180) % 360) - 180
      if (delta < -180) delta += 360
      deltas.push(delta)
      const dt = ti - tPrev
      if (dt > 1e-6) {
        const prevSpeed = speeds[i - 1] ?? 0
        accels.push(((speed ?? 0) - prevSpeed) / dt)
      }
    } else {
      headings.push(ping.heading_deg ?? 0)
    }
  }

  const speedMean = speeds.reduce((a, b) => a + b, 0) / speeds.length
  const itineraryCoords = itinerary?.coordinates ?? []
  let itineraryDistanceM = 0
  if (itineraryCoords.length > 0) {
    const dists = ordered.map((p) =>
      pointToLinestringM(p.lat, p.lon, itineraryCoords),
    )
    itineraryDistanceM = dists.reduce((a, b) => a + b, 0) / dists.length
  }

  const stops = detectStops(ordered)
  const inAccommodation = ordered.some((p) =>
    zones.some(
      (z) =>
        z.category === "accommodation" &&
        z.geom !== null &&
        pointInPolygon(p.lat, p.lon, z.geom),
    ),
  )

  const centroidLat = ordered.reduce((a, p) => a + p.lat, 0) / n
  const centroidLon = ordered.reduce((a, p) => a + p.lon, 0) / n
  const rgSq = ordered.map(
    (p) => haversine({ lat: p.lat, lon: p.lon }, { lat: centroidLat, lon: centroidLon }) ** 2,
  )
  const radiusOfGyration = Math.sqrt(rgSq.reduce((a, b) => a + b, 0) / rgSq.length)
  const totalDistance = segmentDist.reduce((a, b) => a + b, 0)
  const first = ordered[0]
  const last = ordered[n - 1]
  const net =
    first && last
      ? haversine({ lat: first.lat, lon: first.lon }, { lat: last.lat, lon: last.lon })
      : 0
  const straightness =
    totalDistance <= 1e-6 ? (net <= 1e-6 ? 1 : 0) : Math.min(1, net / totalDistance)

  let nightFraction = 0
  if (n === 1 && first) {
    nightFraction =
      istHour(first.recorded_at) >= 22 || istHour(first.recorded_at) < 5 ? 1 : 0
  } else {
    let nightS = 0
    for (let i = 0; i < n - 1; i += 1) {
      const ping = ordered[i]
      const tA = times[i]
      const tB = times[i + 1]
      if (!ping || tA === undefined || tB === undefined) continue
      const dt = Math.max(0, tB - tA)
      const hour = istHour(ping.recorded_at)
      if (hour >= 22 || hour < 5) nightS += dt
    }
    nightFraction = windowDurationS > 0 ? nightS / windowDurationS : 0
  }

  let zoneRiskDwell = 0
  if (n === 1 || windowDurationS <= 0 || zones.length === 0) {
    const p = last ?? first
    zoneRiskDwell = p ? maxZoneWeight(p.lat, p.lon, zones) : 0
  } else {
    let weighted = 0
    for (let i = 0; i < n - 1; i += 1) {
      const ping = ordered[i]
      const tA = times[i]
      const tB = times[i + 1]
      if (!ping || tA === undefined || tB === undefined) continue
      weighted += Math.max(0, tB - tA) * maxZoneWeight(ping.lat, ping.lon, zones)
    }
    zoneRiskDwell = weighted / windowDurationS
  }

  const gaps: number[] = []
  for (let i = 1; i < times.length; i += 1) {
    const a = times[i - 1]
    const b = times[i]
    if (a === undefined || b === undefined) continue
    const g = b - a
    if (g >= 0) gaps.push(g)
  }
  const gapMean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
  const gapMax = gaps.length ? Math.max(...gaps) : 0

  const battT: number[] = []
  const battV: number[] = []
  for (let i = 0; i < ordered.length; i += 1) {
    const ping = ordered[i]
    const ts = times[i]
    if (!ping || ts === undefined || ping.battery_pct === null) continue
    battT.push((ts - t0) / 3600)
    battV.push(ping.battery_pct)
  }
  let slope = 0
  if (battV.length >= 2) {
    const tMin = Math.min(...battT)
    const tMax = Math.max(...battT)
    if (tMax - tMin > 1e-9) {
      const nB = battT.length
      const meanT = battT.reduce((a, b) => a + b, 0) / nB
      const meanV = battV.reduce((a, b) => a + b, 0) / nB
      let num = 0
      let den = 0
      for (let i = 0; i < nB; i += 1) {
        const t = battT[i]
        const v = battV[i]
        if (t === undefined || v === undefined) continue
        num += (t - meanT) * (v - meanV)
        den += (t - meanT) ** 2
      }
      slope = den > 0 ? num / den : 0
    }
  }

  const byName: Record<(typeof FEATURE_NAMES)[number], number> = {
    speed_mean_mps: speedMean,
    speed_std_mps: stddev(speeds),
    speed_max_mps: speeds.length ? Math.max(...speeds) : 0,
    accel_std_mps2: stddev(accels),
    bearing_change_entropy: shannonEntropyNorm(deltas, -180, 180),
    stop_count: stops.count,
    stop_duration_s: stops.durationS,
    itinerary_distance_m: itineraryDistanceM,
    radius_of_gyration_m: radiusOfGyration,
    straightness_index: straightness,
    night_fraction: nightFraction,
    zone_risk_weighted_dwell: zoneRiskDwell,
    ping_gap_mean_s: gapMean,
    ping_gap_max_s: gapMax,
    battery_slope_pct_per_h: slope,
    total_distance_m: totalDistance,
    window_duration_s: windowDurationS,
    n_pings: n,
  }

  const vector = FEATURE_NAMES.map((name) => byName[name])
  return {
    vector,
    inAccommodation: inAccommodation || stops.inAcc,
    stopCount: stops.count,
    stopDurationS: stops.durationS,
  }
}

export function safetyScoreFromWindow(args: {
  window: ExtractedWindow
  zones: ScoreZone[]
  lastPing: ScorePing | null
  openHighIncidents: number
  anomalyScore: number
  itinerary: ScoreItinerary | null
}): number {
  const last = args.lastPing
  let risk: RiskLevel | null = null
  if (last) {
    let best: RiskLevel | null = null
    let bestRank = -1
    const rank: Record<RiskLevel, number> = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    }
    for (const zone of args.zones) {
      if (!zone.geom) continue
      if (pointInPolygon(last.lat, last.lon, zone.geom)) {
        const r = rank[zone.risk_level]
        if (r > bestRank) {
          bestRank = r
          best = zone.risk_level
        }
      }
    }
    risk = best
  }
  const itineraryDistance = args.window.vector[7] ?? 0
  const corridor = args.itinerary?.corridor_m ?? 2000
  const deviationM = Math.max(0, itineraryDistance - corridor)
  const gapMax = args.window.vector[13] ?? 0
  return computeSafetyScore({
    risk,
    deviationM: deviationM > 0 ? deviationM : null,
    silenceMinutes: gapMax / 60,
    openHighIncidents: args.openHighIncidents,
    anomalyScore: args.anomalyScore,
    at: last?.recorded_at ?? new Date().toISOString(),
    inAccommodation: args.window.inAccommodation,
  })
}
