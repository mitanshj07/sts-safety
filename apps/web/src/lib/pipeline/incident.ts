// apps/web/src/lib/pipeline/incident.ts
import "server-only"

import { incidentRecordHash, type DetectionSource, type SeverityLevel } from "@sts/shared"

import { generateIncidentNarrative, translateAlertText } from "@/lib/ai/brief"
import type { ScoreItinerary, ScorePing, ScoreZone } from "@/lib/ai/features"
import { scoreIncidentWindow } from "@/lib/ai/score-client"
import { appendIncidentEvent } from "@/lib/command/audit"
import { fetchIncidentById } from "@/lib/command/queries"
import type { LiveIncident } from "@/lib/command/types"
import { activeChainId, incidentAnchorAddress } from "@/lib/chain/config"
import { anchorMinSeverity } from "@/lib/chain/env"
import { serverEnv } from "@/lib/env/server"
import {
  asRecord,
  lineStringFromGeog,
  lonLatFromGeog,
  polygonFromGeog,
} from "@/lib/geo/parse"
import { reverseGeocode } from "@/lib/geo/photon"
import { createBudget } from "@/lib/pipeline/budget"
import { triggerIncidentDispatch } from "@/lib/pipeline/dispatch"
import { escalateOne, severityAtLeast } from "@/lib/pipeline/severity"
import { createAdminClient } from "@/lib/supabase/admin"

export type PipelineResult = {
  ok: true
  incident_id: string
  score_source: string
  failures: string[]
  elapsed_ms: number
}

function mergePayload(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...existing, ...patch }
}

async function loadPings(touristId: string | null): Promise<ScorePing[]> {
  if (!touristId) return []
  const admin = createAdminClient()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from("location_pings")
    .select("geog, recorded_at, speed_mps, heading_deg, battery_pct, accuracy_m")
    .eq("tourist_id", touristId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true })
    .limit(720)
  return (data ?? []).flatMap((row) => {
    const rec = asRecord(row)
    const point = lonLatFromGeog(rec.geog)
    if (!point || typeof rec.recorded_at !== "string") return []
    return [
      {
        lat: point.lat,
        lon: point.lon,
        recorded_at: rec.recorded_at,
        speed_mps: typeof rec.speed_mps === "number" ? rec.speed_mps : null,
        heading_deg: typeof rec.heading_deg === "number" ? rec.heading_deg : null,
        battery_pct: typeof rec.battery_pct === "number" ? rec.battery_pct : null,
        accuracy_m: typeof rec.accuracy_m === "number" ? rec.accuracy_m : null,
      },
    ]
  })
}

async function loadItinerary(touristId: string | null): Promise<ScoreItinerary | null> {
  if (!touristId) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from("itineraries")
    .select("path, corridor_m, waypoints")
    .eq("tourist_id", touristId)
    .eq("active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const rec = asRecord(data)
  const line = lineStringFromGeog(rec.path)
  const coordinates: Array<[number, number]> = (line?.coordinates ?? []).flatMap((pos) => {
    const lon = pos[0]
    const lat = pos[1]
    if (typeof lon !== "number" || typeof lat !== "number") return []
    return [[lon, lat] as [number, number]]
  })
  const waypointsRaw = Array.isArray(rec.waypoints) ? rec.waypoints : []
  const waypoints = waypointsRaw.flatMap((w) => {
    if (!w || typeof w !== "object") return []
    const row = asRecord(w)
    if (typeof row.lat !== "number" || typeof row.lon !== "number") return []
    return [
      {
        name: typeof row.name === "string" ? row.name : "waypoint",
        lat: row.lat,
        lon: row.lon,
      },
    ]
  })
  return {
    coordinates,
    corridor_m: typeof rec.corridor_m === "number" ? rec.corridor_m : 2000,
    waypoints,
  }
}

async function loadZones(): Promise<ScoreZone[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("zones")
    .select("name, category, risk_level, geom")
    .eq("active", true)
  return (data ?? []).flatMap((row) => {
    const rec = asRecord(row)
    const poly = polygonFromGeog(rec.geom)
    const geom = poly
      ? poly.coordinates.map((ring) =>
          ring.flatMap((pos) => {
            const lon = pos[0]
            const lat = pos[1]
            if (typeof lon !== "number" || typeof lat !== "number") return []
            return [[lon, lat] as [number, number]]
          }),
        )
      : null
    if (typeof rec.name !== "string" || typeof rec.category !== "string") return []
    const risk = rec.risk_level
    if (
      risk !== "none" &&
      risk !== "low" &&
      risk !== "medium" &&
      risk !== "high" &&
      risk !== "critical"
    ) {
      return []
    }
    return [
      {
        name: rec.name,
        category: rec.category,
        risk_level: risk,
        geom,
      },
    ]
  })
}

async function loadLocale(touristId: string | null): Promise<string> {
  if (!touristId) return serverEnv.defaultLocale
  const admin = createAdminClient()
  const { data } = await admin
    .from("tourists")
    .select("profile_id, profiles(locale)")
    .eq("id", touristId)
    .maybeSingle()
  const rec = asRecord(data)
  const profiles = rec.profiles
  const profile = Array.isArray(profiles)
    ? asRecord(profiles[0])
    : asRecord(profiles)
  return typeof profile.locale === "string" && profile.locale.length > 0
    ? profile.locale
    : serverEnv.defaultLocale
}

async function countOpenHigh(touristId: string | null): Promise<number> {
  if (!touristId) return 0
  const admin = createAdminClient()
  const { count } = await admin
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("tourist_id", touristId)
    .in("status", ["open", "acknowledged", "dispatched"])
    .in("severity", ["high", "critical"])
  return count ?? 0
}

export async function runIncidentPipeline(incidentId: string): Promise<PipelineResult> {
  const started = Date.now()
  const budget = createBudget()
  const failures: string[] = []
  const admin = createAdminClient()

  const incident = await fetchIncidentById(incidentId)
  if (!incident) {
    return {
      ok: true,
      incident_id: incidentId,
      score_source: "rules-only",
      failures: ["incident_not_found"],
      elapsed_ms: Date.now() - started,
    }
  }

  const [pings, itinerary, zones, locale, openHigh] = await Promise.all([
    loadPings(incident.tourist_id),
    loadItinerary(incident.tourist_id),
    loadZones(),
    loadLocale(incident.tourist_id),
    countOpenHigh(incident.tourist_id),
  ])

  let addressText = incident.address_text
  let payload = { ...incident.payload }

  // --- b. reverse geocode (optional) ---
  if (budget.has(400) && incident.lat !== null && incident.lon !== null) {
    try {
      const geo = await reverseGeocode({
        lat: incident.lat,
        lon: incident.lon,
        timeoutMs: Math.min(2500, budget.remaining()),
      })
      if (geo) {
        addressText = geo.address_text
        payload = mergePayload(payload, {
          geohash: geo.geohash,
          geocode_provider: geo.provider,
        })
      } else {
        failures.push("geocode")
      }
    } catch (cause) {
      failures.push(`geocode:${cause instanceof Error ? cause.message : "failed"}`)
    }
  } else if (incident.lat !== null) {
    failures.push("geocode:budget")
  }

  // --- c. scoring: HF → ONNX → rules-only ---
  // The LLM is not consulted here. ML may escalate severity; it never creates the alert.
  let scoreSource = "rules-only"
  let anomalyScore = incident.anomaly_score ?? 0
  let safetyScore = incident.safety_score_at
  try {
    const scored = await scoreIncidentWindow({
      pings,
      itinerary,
      zones,
      openHighIncidents: openHigh,
      timeoutMs: Math.min(serverEnv.hfSpaceTimeoutMs, Math.max(0, budget.remaining() - 2500)),
    })
    scoreSource = scored.source
    anomalyScore = scored.anomaly_score
    safetyScore = scored.safety_score
    payload = mergePayload(payload, {
      score_source: scored.source,
      score_features: scored.features,
    })
    if (scored.error) {
      failures.push(`score:${scored.error}`)
    }
  } catch (cause) {
    scoreSource = "rules-only"
    failures.push(`score:${cause instanceof Error ? cause.message : "failed"}`)
    payload = mergePayload(payload, { score_source: "rules-only" })
  }

  let severity: SeverityLevel = incident.severity
  let detectedBy: DetectionSource = incident.detected_by
  const threshold = Number.isFinite(serverEnv.anomalyThreshold)
    ? serverEnv.anomalyThreshold
    : 0.72
  if (anomalyScore > threshold) {
    const next = escalateOne(severity)
    if (next !== severity) {
      await appendIncidentEvent({
        incidentId,
        eventType: "escalated",
        actorLabel: "pipeline",
        detail: {
          from: severity,
          to: next,
          reason: "anomaly_score",
          anomaly_score: anomalyScore,
          score_source: scoreSource,
        },
      })
    }
    severity = next
    detectedBy = "rules+ml"
  }

  const working: LiveIncident = {
    ...incident,
    address_text: addressText,
    anomaly_score: anomalyScore,
    safety_score_at: safetyScore,
    severity,
    detected_by: detectedBy,
    payload,
  }

  // --- e. AI brief (optional, never gates the alert) ---
  let aiBrief = incident.ai_brief
  let aiBriefModel = incident.ai_brief_model
  if (budget.has(300)) {
    try {
      const narrative = await generateIncidentNarrative(
        working,
        "brief",
        Math.min(serverEnv.llmTimeoutMs, budget.remaining()),
      )
      aiBrief = narrative.text
      aiBriefModel = narrative.model
      if (narrative.fallbackUsed) {
        failures.push("brief:fallback")
      }
      if (locale !== "en" && budget.has(200)) {
        const translated = await translateAlertText({
          text: narrative.text,
          locale,
          timeoutMs: Math.min(4000, budget.remaining()),
        })
        payload = mergePayload(payload, {
          alert_locale: locale,
          alert_locale_body: translated.text,
        })
      }
    } catch (cause) {
      failures.push(`brief:${cause instanceof Error ? cause.message : "failed"}`)
    }
  } else {
    failures.push("brief:budget")
  }

  let recordHash: string | null = incident.record_hash
  if (working.lat !== null && working.lon !== null) {
    recordHash = incidentRecordHash({
      id: working.id,
      tourist_token_id: working.tourist_token_id,
      type: working.type,
      severity: working.severity,
      occurred_at: working.occurred_at,
      lat: working.lat,
      lon: working.lon,
      zone_id: working.zone_id,
      detected_by: working.detected_by,
      payload,
    })
  }

  payload = mergePayload(payload, {
    score_source: scoreSource,
    pipeline_failures: failures,
    pipeline_ms: Date.now() - started,
  })

  await admin
    .from("incidents")
    .update({
      address_text: addressText,
      anomaly_score: anomalyScore,
      safety_score_at: safetyScore,
      severity,
      detected_by: detectedBy,
      ai_brief: aiBrief,
      ai_brief_model: aiBriefModel,
      record_hash: recordHash,
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", incidentId)

  if (working.tourist_id && typeof safetyScore === "number") {
    await admin
      .from("tourists")
      .update({ safety_score: safetyScore, updated_at: new Date().toISOString() })
      .eq("id", working.tourist_id)
  }

  if (
    recordHash &&
    severityAtLeast(severity, anchorMinSeverity())
  ) {
    try {
      const { error } = await admin.from("chain_anchors").insert({
        kind: "incident",
        subject_id: incidentId,
        record_hash: recordHash,
        chain_id: activeChainId(),
        contract_address: incidentAnchorAddress(),
        status: "pending",
      })
      if (error && !/duplicate|unique/i.test(error.message)) {
        failures.push(`anchor:${error.message}`)
      }
    } catch (cause) {
      failures.push(`anchor:${cause instanceof Error ? cause.message : "failed"}`)
    }
  }

  // --- f. dispatch (safety path — always attempted) ---
  try {
    const dispatched = await triggerIncidentDispatch({
      incidentId,
      lat: working.lat,
      lon: working.lon,
      status: working.status,
    })
    if (dispatched.error) {
      failures.push(`dispatch:${dispatched.error}`)
    }
  } catch (cause) {
    failures.push(`dispatch:${cause instanceof Error ? cause.message : "failed"}`)
  }

  return {
    ok: true,
    incident_id: incidentId,
    score_source: scoreSource,
    failures,
    elapsed_ms: Date.now() - started,
  }
}
