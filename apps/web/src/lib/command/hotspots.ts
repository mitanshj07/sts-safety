// apps/web/src/lib/command/hotspots.ts
import "server-only"

import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import {
  HOTSPOT_LOOKBACK_HOURS,
  RESERVED_ZONE_CATEGORIES,
  clusterHotspotIncidents,
  polygonSchema,
  type ClusterableIncident,
  type GeoJsonPolygon,
  type HotspotCluster,
  type SuggestionStatus,
  type ZoneCategory,
} from "@sts/shared"
import { generateHotspotNarrative } from "@/lib/ai/hotspots"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { asRecord, lonLatFromGeog } from "@/lib/geo/parse"
import type { HotspotSuggestion, LiveZone } from "@/lib/command/types"

const SURGE_REOPEN_TOURISTS = 2

type SuggestionRow = {
  id: string
  cluster_key: string
  status: SuggestionStatus
  unique_tourists: number
  incident_count: number
  rationale: string
  proposed_name: string
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function asTypeCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    if (typeof count === "number" && Number.isFinite(count)) out[key] = count
  }
  return out
}

function parseProposedGeom(value: unknown): GeoJsonPolygon | null {
  const parsed = polygonSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function reservedCover(centroid: { lat: number; lon: number }, zones: LiveZone[]): {
  id: string
  name: string
} | null {
  const pt: [number, number] = [centroid.lon, centroid.lat]
  for (const zone of zones) {
    if (!zone.geom) continue
    if (!RESERVED_ZONE_CATEGORIES.includes(zone.category as (typeof RESERVED_ZONE_CATEGORIES)[number])) {
      continue
    }
    try {
      if (booleanPointInPolygon(pt, zone.geom)) {
        return { id: zone.id, name: zone.name }
      }
    } catch {
      continue
    }
  }
  return null
}

function mapSuggestion(row: Record<string, unknown>): HotspotSuggestion | null {
  const geom = parseProposedGeom(row.proposed_geom)
  const lat = typeof row.centroid_lat === "number" ? row.centroid_lat : null
  const lon = typeof row.centroid_lon === "number" ? row.centroid_lon : null
  if (!geom || lat === null || lon === null) return null
  const coveringId = typeof row.covering_zone_id === "string" ? row.covering_zone_id : null
  return {
    id: String(row.id),
    cluster_key: String(row.cluster_key),
    status: (row.status as SuggestionStatus) ?? "open",
    lat,
    lon,
    radius_m: Number(row.radius_m ?? 0),
    incident_count: Number(row.incident_count ?? 0),
    unique_tourists: Number(row.unique_tourists ?? 0),
    sos_count: Number(row.sos_count ?? 0),
    dominant_type: (row.dominant_type as HotspotSuggestion["dominant_type"]) ?? "sos",
    type_counts: asTypeCounts(row.type_counts),
    incident_ids: asStringArray(row.incident_ids),
    proposed_name: String(row.proposed_name ?? "Reserved area"),
    proposed_category: (row.proposed_category as ZoneCategory) ?? "restricted",
    proposed_risk: (row.proposed_risk as HotspotSuggestion["proposed_risk"]) ?? "high",
    proposed_geom: geom,
    address_text: typeof row.address_text === "string" ? row.address_text : null,
    covering_zone_id: coveringId,
    covering_zone_name: typeof row.covering_zone_name === "string" ? row.covering_zone_name : null,
    already_reserved: Boolean(coveringId),
    rationale: String(row.rationale ?? ""),
    rationale_model: typeof row.rationale_model === "string" ? row.rationale_model : null,
    score: Number(row.score ?? 0),
    first_at: typeof row.first_at === "string" ? row.first_at : null,
    last_at: typeof row.last_at === "string" ? row.last_at : null,
    window_hours: Number(row.window_hours ?? HOTSPOT_LOOKBACK_HOURS),
    zone_id: typeof row.zone_id === "string" ? row.zone_id : null,
  }
}

async function fetchClusterableIncidents(): Promise<ClusterableIncident[]> {
  const admin = createAdminSupabase()
  const cutoff = new Date(Date.now() - HOTSPOT_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from("incidents")
    .select("id, tourist_id, type, geog, address_text, occurred_at")
    .gte("occurred_at", cutoff)
    .not("status", "in", "(false_positive,expired)")
    .order("occurred_at", { ascending: false })
    .limit(2000)
  if (error) {
    console.error("hotspot incidents", error.message)
    return []
  }
  return (data ?? []).flatMap((row) => {
    const rec = asRecord(row)
    const coords = lonLatFromGeog(rec.geog)
    if (!coords) return []
    return [
      {
        id: String(rec.id),
        tourist_id: typeof rec.tourist_id === "string" ? rec.tourist_id : null,
        type: rec.type as ClusterableIncident["type"],
        lat: coords.lat,
        lon: coords.lon,
        occurred_at: String(rec.occurred_at),
        address_text: typeof rec.address_text === "string" ? rec.address_text : null,
      },
    ]
  })
}

function payloadFromCluster(
  cluster: HotspotCluster,
  covering: { id: string; name: string } | null,
  narrative: { proposedName: string; rationale: string; category: ZoneCategory; riskLevel: HotspotSuggestion["proposed_risk"]; model: string },
) {
  return {
    cluster_key: cluster.key,
    status: "open" as const,
    centroid_lat: cluster.centroid.lat,
    centroid_lon: cluster.centroid.lon,
    radius_m: cluster.radiusM,
    incident_count: cluster.incidentCount,
    unique_tourists: cluster.uniqueTourists,
    sos_count: cluster.sosCount,
    dominant_type: cluster.dominantType,
    type_counts: cluster.typeCounts,
    incident_ids: cluster.incidentIds,
    tourist_ids: cluster.touristIds,
    proposed_name: narrative.proposedName,
    proposed_category: narrative.category,
    proposed_risk: narrative.riskLevel,
    proposed_geom: cluster.proposedGeom,
    address_text: cluster.addressText,
    covering_zone_id: covering?.id ?? null,
    covering_zone_name: covering?.name ?? null,
    rationale: narrative.rationale,
    rationale_model: narrative.model,
    window_hours: HOTSPOT_LOOKBACK_HOURS,
    score: cluster.score,
    first_at: cluster.firstAt,
    last_at: cluster.lastAt,
    updated_at: new Date().toISOString(),
  }
}

export async function scanHotspotSuggestions(zones: LiveZone[]): Promise<HotspotSuggestion[]> {
  const admin = createAdminSupabase()
  const incidents = await fetchClusterableIncidents()
  const clusters = clusterHotspotIncidents(incidents)
  const { data: existingRows } = await admin
    .from("ai_zone_suggestions")
    .select(
      "id, cluster_key, status, unique_tourists, incident_count, rationale, proposed_name, decided_at, created_at",
    )
    .order("updated_at", { ascending: false })
    .limit(200)

  const existing = (existingRows ?? []) as SuggestionRow[]
  const openByKey = new Map<string, SuggestionRow>()
  const dismissedByKey = new Map<string, SuggestionRow>()
  const acceptedByKey = new Map<string, SuggestionRow>()
  for (const row of existing) {
    if (row.status === "open" && !openByKey.has(row.cluster_key)) openByKey.set(row.cluster_key, row)
    if (row.status === "dismissed" && !dismissedByKey.has(row.cluster_key)) {
      dismissedByKey.set(row.cluster_key, row)
    }
    if (row.status === "accepted" && !acceptedByKey.has(row.cluster_key)) {
      acceptedByKey.set(row.cluster_key, row)
    }
  }

  const activeKeys = new Set<string>()
  for (const cluster of clusters) {
    activeKeys.add(cluster.key)
    const covering = reservedCover(cluster.centroid, zones)
    const open = openByKey.get(cluster.key)
    const dismissed = dismissedByKey.get(cluster.key)
    const accepted = acceptedByKey.get(cluster.key)

    if (accepted && covering) continue
    if (
      dismissed &&
      cluster.uniqueTourists < dismissed.unique_tourists + SURGE_REOPEN_TOURISTS
    ) {
      continue
    }

    const countsUnchanged =
      open &&
      open.incident_count === cluster.incidentCount &&
      open.unique_tourists === cluster.uniqueTourists

    const narrative = countsUnchanged
      ? {
          proposedName: open.proposed_name,
          rationale: open.rationale,
          category: cluster.proposedCategory,
          riskLevel: cluster.proposedRisk,
          model: "cached",
        }
      : await generateHotspotNarrative(cluster, covering?.name ?? null, HOTSPOT_LOOKBACK_HOURS).then(
          (n) => ({
            proposedName: n.proposedName,
            rationale: n.rationale,
            category: n.category,
            riskLevel: n.riskLevel,
            model: n.model,
          }),
        )

    const payload = payloadFromCluster(cluster, covering, narrative)
    if (open) {
      await admin.from("ai_zone_suggestions").update(payload).eq("id", open.id)
    } else {
      await admin.from("ai_zone_suggestions").insert(payload)
    }
  }

  for (const open of openByKey.values()) {
    if (!activeKeys.has(open.cluster_key)) {
      await admin
        .from("ai_zone_suggestions")
        .update({ status: "dismissed", updated_at: new Date().toISOString() })
        .eq("id", open.id)
        .eq("status", "open")
    }
  }

  return listStoredSuggestions()
}

export async function listStoredSuggestions(): Promise<HotspotSuggestion[]> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("ai_zone_suggestions")
    .select("*")
    .eq("status", "open")
    .order("score", { ascending: false })
    .limit(50)
  if (error) {
    console.error("list suggestions", error.message)
    return []
  }
  return (data ?? []).flatMap((row) => {
    const mapped = mapSuggestion(asRecord(row))
    return mapped ? [mapped] : []
  })
}

export async function fetchSuggestionById(id: string): Promise<HotspotSuggestion | null> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("ai_zone_suggestions")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return mapSuggestion(asRecord(data))
}
