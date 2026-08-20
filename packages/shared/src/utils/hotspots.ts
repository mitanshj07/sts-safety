// packages/shared/src/utils/hotspots.ts
import {
  HOTSPOT_CLUSTER_RADIUS_M,
  HOTSPOT_DEFAULT_CATEGORY,
  HOTSPOT_DEFAULT_RISK,
  HOTSPOT_INCIDENT_TYPES,
  HOTSPOT_LOOKBACK_HOURS,
  HOTSPOT_MAX_ZONE_RADIUS_M,
  HOTSPOT_MIN_INCIDENTS,
  HOTSPOT_MIN_UNIQUE_TOURISTS,
  HOTSPOT_MIN_ZONE_RADIUS_M,
  HOTSPOT_TYPE_WEIGHT,
  HOTSPOT_ZONE_PAD_M,
  type HotspotIncidentType,
} from "../constants/hotspots"
import type { IncidentType, RiskLevel, ZoneCategory } from "../schemas/enums"
import { circlePolygon, haversine, type GeoJsonPolygon, type LonLat } from "./geo"

export type ClusterableIncident = {
  id: string
  tourist_id: string | null
  type: IncidentType
  lat: number
  lon: number
  occurred_at: string
  address_text?: string | null
}

export type HotspotClusterOptions = {
  radiusM?: number
  minUniqueTourists?: number
  minIncidents?: number
  lookbackHours?: number
  now?: Date
}

export type HotspotCluster = {
  key: string
  centroid: LonLat
  radiusM: number
  proposedGeom: GeoJsonPolygon
  incidentIds: string[]
  touristIds: string[]
  uniqueTourists: number
  incidentCount: number
  typeCounts: Partial<Record<IncidentType, number>>
  dominantType: IncidentType
  sosCount: number
  firstAt: string
  lastAt: string
  score: number
  addressText: string | null
  proposedName: string
  proposedCategory: ZoneCategory
  proposedRisk: RiskLevel
}

const HOTSPOT_TYPE_SET = new Set<string>(HOTSPOT_INCIDENT_TYPES)

export function isHotspotIncidentType(type: string): type is HotspotIncidentType {
  return HOTSPOT_TYPE_SET.has(type)
}

export function hotspotClusterKey(centroid: LonLat): string {
  return `c:${centroid.lat.toFixed(2)}:${centroid.lon.toFixed(2)}`
}

function meanCentroid(points: LonLat[]): LonLat {
  const first = points[0]
  if (!first) return { lat: 0, lon: 0 }
  let lat = 0
  let lon = 0
  for (const point of points) {
    lat += point.lat
    lon += point.lon
  }
  return {
    lat: lat / points.length,
    lon: lon / points.length,
  }
}

function maxSpreadM(centroid: LonLat, points: LonLat[]): number {
  let max = 0
  for (const point of points) {
    const d = haversine(centroid, point)
    if (d > max) max = d
  }
  return max
}

function proposedRadiusM(spreadM: number): number {
  return Math.min(
    HOTSPOT_MAX_ZONE_RADIUS_M,
    Math.max(HOTSPOT_MIN_ZONE_RADIUS_M, Math.round(spreadM + HOTSPOT_ZONE_PAD_M)),
  )
}

function typeWeight(type: IncidentType): number {
  if (isHotspotIncidentType(type)) return HOTSPOT_TYPE_WEIGHT[type]
  return 0
}

function dominantType(counts: Partial<Record<IncidentType, number>>): IncidentType {
  let best: IncidentType = "sos"
  let bestScore = -1
  for (const [type, count] of Object.entries(counts)) {
    if (typeof count !== "number") continue
    const weighted = count * typeWeight(type as IncidentType)
    if (weighted > bestScore) {
      bestScore = weighted
      best = type as IncidentType
    }
  }
  return best
}

function mostCommonAddress(incidents: ClusterableIncident[]): string | null {
  const counts = new Map<string, number>()
  for (const incident of incidents) {
    const text = incident.address_text?.trim()
    if (!text) continue
    counts.set(text, (counts.get(text) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [text, count] of counts) {
    if (count > bestCount) {
      best = text
      bestCount = count
    }
  }
  return best
}

function proposedName(args: {
  dominantType: IncidentType
  addressText: string | null
  centroid: LonLat
  uniqueTourists: number
}): string {
  const place = args.addressText
    ? args.addressText.split(",")[0]?.trim()
    : null
  if (place && place.length >= 3 && place.length <= 40) {
    return `Reserved · ${place}`
  }
  const kind = args.dominantType === "sos" ? "SOS hotspot" : args.dominantType.replaceAll("_", " ")
  return `${kind} · ${args.centroid.lat.toFixed(3)}N ${args.centroid.lon.toFixed(3)}E`
}

function dbscanLabels(points: LonLat[], epsM: number, minPts: number): number[] {
  const n = points.length
  const labels = Array.from({ length: n }, () => -1)
  const visited = Array.from({ length: n }, () => false)
  let cluster = 0

  const neighborsOf = (i: number): number[] => {
    const origin = points[i]
    if (!origin) return []
    const out: number[] = []
    for (let j = 0; j < n; j += 1) {
      const other = points[j]
      if (!other) continue
      if (haversine(origin, other) <= epsM) out.push(j)
    }
    return out
  }

  for (let i = 0; i < n; i += 1) {
    if (visited[i]) continue
    visited[i] = true
    const neighbors = neighborsOf(i)
    if (neighbors.length < minPts) {
      labels[i] = -1
      continue
    }
    labels[i] = cluster
    const queue = neighbors.filter((j) => j !== i)
    for (let q = 0; q < queue.length; q += 1) {
      const j = queue[q]
      if (j === undefined) continue
      if (!visited[j]) {
        visited[j] = true
        const next = neighborsOf(j)
        if (next.length >= minPts) {
          for (const k of next) {
            if (!queue.includes(k)) queue.push(k)
          }
        }
      }
      if (labels[j] === -1) labels[j] = cluster
    }
    cluster += 1
  }
  return labels
}

export function clusterHotspotIncidents(
  incidents: readonly ClusterableIncident[],
  options: HotspotClusterOptions = {},
): HotspotCluster[] {
  const radiusM = options.radiusM ?? HOTSPOT_CLUSTER_RADIUS_M
  const minTourists = options.minUniqueTourists ?? HOTSPOT_MIN_UNIQUE_TOURISTS
  const minIncidents = options.minIncidents ?? HOTSPOT_MIN_INCIDENTS
  const lookbackHours = options.lookbackHours ?? HOTSPOT_LOOKBACK_HOURS
  const now = options.now ?? new Date()
  const cutoff = now.getTime() - lookbackHours * 60 * 60 * 1000

  const eligible = incidents.filter((incident) => {
    if (!isHotspotIncidentType(incident.type)) return false
    if (!Number.isFinite(incident.lat) || !Number.isFinite(incident.lon)) return false
    const occurred = Date.parse(incident.occurred_at)
    if (!Number.isFinite(occurred) || occurred < cutoff) return false
    return true
  })

  if (eligible.length === 0) return []

  const points = eligible.map((incident) => ({ lat: incident.lat, lon: incident.lon }))
  const labels = dbscanLabels(points, radiusM, 2)
  const grouped = new Map<number, ClusterableIncident[]>()
  for (let i = 0; i < eligible.length; i += 1) {
    const label = labels[i]
    const incident = eligible[i]
    if (label === undefined || label < 0 || !incident) continue
    const bucket = grouped.get(label) ?? []
    bucket.push(incident)
    grouped.set(label, bucket)
  }

  const clusters: HotspotCluster[] = []
  for (const members of grouped.values()) {
    if (members.length < minIncidents) continue
    const touristIds = [
      ...new Set(members.map((row) => row.tourist_id).filter((id): id is string => Boolean(id))),
    ]
    if (touristIds.length < minTourists) continue

    const memberPoints = members.map((row) => ({ lat: row.lat, lon: row.lon }))
    const centroid = meanCentroid(memberPoints)
    const spread = maxSpreadM(centroid, memberPoints)
    const zoneRadius = proposedRadiusM(spread)
    const typeCounts: Partial<Record<IncidentType, number>> = {}
    let sosCount = 0
    let firstAt = members[0]?.occurred_at ?? now.toISOString()
    let lastAt = firstAt
    let score = touristIds.length * 10
    for (const row of members) {
      typeCounts[row.type] = (typeCounts[row.type] ?? 0) + 1
      if (row.type === "sos") sosCount += 1
      score += typeWeight(row.type)
      if (row.occurred_at < firstAt) firstAt = row.occurred_at
      if (row.occurred_at > lastAt) lastAt = row.occurred_at
    }
    const dominant = dominantType(typeCounts)
    const addressText = mostCommonAddress(members)
    const proposedCategory =
      sosCount >= minTourists ? "restricted" : HOTSPOT_DEFAULT_CATEGORY
    const proposedRisk: RiskLevel =
      sosCount >= minTourists ? "critical" : HOTSPOT_DEFAULT_RISK

    clusters.push({
      key: hotspotClusterKey(centroid),
      centroid,
      radiusM: zoneRadius,
      proposedGeom: circlePolygon(centroid, zoneRadius),
      incidentIds: members.map((row) => row.id),
      touristIds,
      uniqueTourists: touristIds.length,
      incidentCount: members.length,
      typeCounts,
      dominantType: dominant,
      sosCount,
      firstAt,
      lastAt,
      score,
      addressText,
      proposedName: proposedName({
        dominantType: dominant,
        addressText,
        centroid,
        uniqueTourists: touristIds.length,
      }),
      proposedCategory,
      proposedRisk,
    })
  }

  return clusters.sort((a, b) => b.score - a.score)
}

export function rulesHotspotRationale(cluster: HotspotCluster, lookbackHours = HOTSPOT_LOOKBACK_HOURS): string {
  const typeSummary = Object.entries(cluster.typeCounts)
    .map(([type, count]) => `${count} ${type.replaceAll("_", " ")}`)
    .join(", ")
  return [
    `${cluster.uniqueTourists} distinct tourists raised ${cluster.incidentCount} alerts (${typeSummary}) within ${cluster.radiusM} m of ${cluster.centroid.lat.toFixed(5)}, ${cluster.centroid.lon.toFixed(5)} in the last ${lookbackHours} h.`,
    `Recommend marking these coordinates as a ${cluster.proposedCategory.replaceAll("_", " ")} (reserved) zone so the geofence engine warns other visitors before they enter.`,
  ].join(" ")
}
