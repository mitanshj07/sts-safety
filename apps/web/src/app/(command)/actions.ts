// apps/web/src/app/(command)/actions.ts
"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import booleanIntersects from "@turf/boolean-intersects"
import kinks from "@turf/kinks"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { appendIncidentEvent, writeAudit } from "@/lib/command/audit"
import { generateIncidentNarrative } from "@/lib/ai/brief"
import { draftEfir } from "@/lib/ai/efir"
import { fetchIncidentById, fetchNearestResponders } from "@/lib/command/queries"
import {
  acknowledgeSchema,
  dispatchSchema,
  escalateSchema,
  falsePositiveSchema,
  generateEfirSchema,
  regenerateBriefSchema,
  resolveSchema,
  saveZoneSchema,
  type ActionResult,
} from "@/lib/command/schemas"
import { etaSeconds } from "@/lib/geo/osrm"
import { haversine } from "@sts/shared"
import { lonLatFromGeog, polygonFromGeog } from "@/lib/geo/parse"

const SEVERITY_ESCALATION = {
  info: "low",
  low: "medium",
  medium: "high",
  high: "critical",
  critical: "critical",
} as const

function fail(error: string): ActionResult {
  return { ok: false, error }
}

function ok(message?: string): ActionResult {
  return { ok: true, message }
}

function revalidateIncident(id: string) {
  revalidatePath("/dashboard")
  revalidatePath("/incidents")
  revalidatePath(`/incidents/${id}`)
  revalidatePath("/analytics")
}

export async function acknowledgeIncident(raw: unknown): Promise<ActionResult> {
  const parsed = acknowledgeSchema.safeParse(raw)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")
  const { ackIncident } = await import("@/lib/notify/lifecycle")
  const result = await ackIncident({
    incidentId: parsed.data.incidentId,
    actorLabel: "command-dashboard",
  })
  if (!result.ok) return fail(result.error)
  await writeAudit({
    action: "incident.acknowledge",
    entity: "incidents",
    entityId: parsed.data.incidentId,
    after: { status: result.status },
  })
  revalidateIncident(parsed.data.incidentId)
  return ok("Acknowledged")
}

export async function escalateIncident(raw: unknown): Promise<ActionResult> {
  const parsed = escalateSchema.safeParse(raw)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")
  const admin = createAdminSupabase()
  const { data: before } = await admin
    .from("incidents")
    .select("id, severity, status")
    .eq("id", parsed.data.incidentId)
    .maybeSingle()
  if (!before) return fail("Incident not found")
  const next =
    SEVERITY_ESCALATION[before.severity as keyof typeof SEVERITY_ESCALATION] ?? "high"
  const { error } = await admin
    .from("incidents")
    .update({ severity: next })
    .eq("id", parsed.data.incidentId)
  if (error) return fail(error.message)
  await appendIncidentEvent({
    incidentId: parsed.data.incidentId,
    eventType: "escalated",
    detail: { from: before.severity, to: next, notes: parsed.data.notes ?? null },
  })
  await writeAudit({
    action: "incident.escalate",
    entity: "incidents",
    entityId: parsed.data.incidentId,
    before,
    after: { severity: next },
  })
  revalidateIncident(parsed.data.incidentId)
  return ok(`Escalated to ${next}`)
}

export async function resolveIncident(raw: unknown): Promise<ActionResult> {
  const parsed = resolveSchema.safeParse(raw)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")
  const { resolveIncidentLifecycle } = await import("@/lib/notify/lifecycle")
  const result = await resolveIncidentLifecycle({
    incidentId: parsed.data.incidentId,
    notes: parsed.data.notes,
    actorLabel: "command-dashboard",
  })
  if (!result.ok) return fail(result.error)
  await writeAudit({
    action: "incident.resolve",
    entity: "incidents",
    entityId: parsed.data.incidentId,
    after: { status: "resolved" },
  })
  revalidateIncident(parsed.data.incidentId)
  return ok("Resolved")
}

export async function markFalsePositive(raw: unknown): Promise<ActionResult> {
  const parsed = falsePositiveSchema.safeParse(raw)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")
  const admin = createAdminSupabase()
  const { data: before } = await admin
    .from("incidents")
    .select("id, status")
    .eq("id", parsed.data.incidentId)
    .maybeSingle()
  if (!before) return fail("Incident not found")
  const { error } = await admin
    .from("incidents")
    .update({
      status: "false_positive",
      resolved_at: new Date().toISOString(),
      resolution_notes: parsed.data.notes ?? "Marked false positive",
    })
    .eq("id", parsed.data.incidentId)
  if (error) return fail(error.message)
  await appendIncidentEvent({
    incidentId: parsed.data.incidentId,
    eventType: "resolved",
    detail: { false_positive: true, notes: parsed.data.notes ?? null },
  })
  await writeAudit({
    action: "incident.false_positive",
    entity: "incidents",
    entityId: parsed.data.incidentId,
    before,
    after: { status: "false_positive" },
  })
  revalidateIncident(parsed.data.incidentId)
  return ok("Marked false positive")
}

export async function dispatchResponder(raw: unknown): Promise<ActionResult> {
  const parsed = dispatchSchema.safeParse(raw)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")
  const admin = createAdminSupabase()
  const [{ data: incident }, { data: responder }] = await Promise.all([
    admin
      .from("incidents")
      .select("id, geog, status, tourist_id, type, severity")
      .eq("id", parsed.data.incidentId)
      .maybeSingle(),
    admin
      .from("responders")
      .select("id, name, base_geog, last_geog, on_duty")
      .eq("id", parsed.data.responderId)
      .maybeSingle(),
  ])
  if (!incident || !responder) return fail("Incident or responder not found")

  const incidentPoint = lonLatFromGeog(incident.geog)
  const responderPoint =
    lonLatFromGeog(responder.last_geog) ?? lonLatFromGeog(responder.base_geog)
  const distance_m =
    incidentPoint && responderPoint ? haversine(responderPoint, incidentPoint) : null
  const eta =
    incidentPoint && responderPoint
      ? await etaSeconds(responderPoint, incidentPoint)
      : { seconds: null as number | null, source: "haversine" as const }

  const { data: inserted, error } = await admin
    .from("dispatches")
    .upsert(
      {
        incident_id: parsed.data.incidentId,
        responder_id: parsed.data.responderId,
        status: "sent",
        distance_m,
        eta_seconds: eta.seconds,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "incident_id,responder_id" },
    )
    .select("id")
    .maybeSingle()

  if (error) return fail(error.message)

  if (incident.status === "open" || incident.status === "acknowledged") {
    await admin
      .from("incidents")
      .update({ status: "dispatched" })
      .eq("id", parsed.data.incidentId)
  }

  await appendIncidentEvent({
    incidentId: parsed.data.incidentId,
    eventType: "dispatched",
    detail: {
      responder_id: parsed.data.responderId,
      responder_name: responder.name,
      distance_m,
      eta_seconds: eta.seconds,
      dispatch_id: inserted?.id ?? null,
    },
  })
  await writeAudit({
    action: "dispatch.create",
    entity: "dispatches",
    entityId: inserted?.id ?? parsed.data.incidentId,
    after: { responder_id: parsed.data.responderId },
  })
  revalidateIncident(parsed.data.incidentId)
  const { broadcastIncident } = await import("@/lib/notify/channels/realtime")
  await broadcastIncident({
    kind: "dispatch",
    incident_id: parsed.data.incidentId,
    tourist_id: incident.tourist_id ?? null,
    status: "dispatched",
    severity: String(incident.severity ?? "high"),
    type: String(incident.type ?? "manual_report"),
    actor_label: "command-dashboard",
    at: new Date().toISOString(),
  })
  return ok(`Dispatched ${responder.name}`)
}

export async function regenerateBrief(raw: unknown): Promise<ActionResult> {
  const parsed = regenerateBriefSchema.safeParse(raw)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")
  const incident = await fetchIncidentById(parsed.data.incidentId)
  if (!incident) return fail("Incident not found")
  const narrative = await generateIncidentNarrative(incident, "brief")
  const admin = createAdminSupabase()
  const { error } = await admin
    .from("incidents")
    .update({ ai_brief: narrative.text, ai_brief_model: narrative.model })
    .eq("id", parsed.data.incidentId)
  if (error) return fail(error.message)
  await appendIncidentEvent({
    incidentId: parsed.data.incidentId,
    eventType: "note",
    detail: { kind: "ai_brief", model: narrative.model },
  })
  await writeAudit({
    action: "incident.regenerate_brief",
    entity: "incidents",
    entityId: parsed.data.incidentId,
    after: { model: narrative.model },
  })
  revalidateIncident(parsed.data.incidentId)
  return ok(`Brief updated (${narrative.model})`)
}

export async function generateEfir(raw: unknown): Promise<ActionResult> {
  const parsed = generateEfirSchema.safeParse(raw)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input")
  try {
    const result = await draftEfir(parsed.data.incidentId)
    revalidateIncident(parsed.data.incidentId)
    const extra = result.failures.length > 0 ? ` (${result.failures.join("; ")})` : ""
    return ok(`E-FIR draft generated${extra}`)
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "E-FIR failed")
  }
}

export async function previewNearestResponders(incidentId: string) {
  const parsed = z.string().uuid().safeParse(incidentId)
  if (!parsed.success) return []
  const incident = await fetchIncidentById(parsed.data)
  if (!incident || incident.lat === null || incident.lon === null) return []
  return fetchNearestResponders(incident.lat, incident.lon, parsed.data)
}

export async function saveZone(raw: unknown): Promise<ActionResult> {
  const parsed = saveZoneSchema.safeParse(raw)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid polygon")

  const coords = parsed.data.geom.coordinates[0]
  if (!coords) return fail("Polygon has no ring")
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    if (first) coords.push(first)
  }

  try {
    const kinked = kinks(parsed.data.geom)
    if (kinked.features.length > 0) {
      return fail("ST_IsValid would fail: polygon self-intersects")
    }
  } catch {
    return fail("ST_IsValid would fail: could not parse polygon")
  }

  const admin = createAdminSupabase()
  const { data: existing } = await admin
    .from("zones")
    .select("id, name, geom")
    .eq("active", true)

  const overlaps: string[] = []
  for (const row of existing ?? []) {
    if (parsed.data.id && row.id === parsed.data.id) continue
    const geom = polygonFromGeog(row.geom as unknown)
    if (!geom) continue
    try {
      if (booleanIntersects(parsed.data.geom, geom)) {
        overlaps.push(String(row.name))
      }
    } catch {
      // skip unparseable existing geom
    }
  }

  const payload = {
    name: parsed.data.name,
    category: parsed.data.category,
    risk_level: parsed.data.risk_level,
    description: parsed.data.description ?? null,
    state_code: parsed.data.state_code ?? null,
    district: parsed.data.district ?? null,
    requires_permit: parsed.data.requires_permit,
    advisory_text: parsed.data.advisory_text ?? null,
    time_windows: parsed.data.time_windows,
    geom: parsed.data.geom,
    active: true,
  }

  const query = parsed.data.id
    ? admin.from("zones").update(payload).eq("id", parsed.data.id).select("id").maybeSingle()
    : admin.from("zones").insert(payload).select("id").maybeSingle()

  const { data, error } = await query
  if (error) {
    if (/zone_geom_valid|st_isvalid/i.test(error.message)) {
      return fail("ST_IsValid failed: PostGIS rejected the polygon")
    }
    return fail(error.message)
  }

  const entityId = data?.id ?? parsed.data.id ?? "unknown"
  await writeAudit({
    action: parsed.data.id ? "zone.update" : "zone.create",
    entity: "zones",
    entityId,
    after: { name: parsed.data.name, overlaps },
  })
  revalidatePath("/zones")
  revalidatePath("/dashboard")
  const overlapNote =
    overlaps.length > 0 ? ` Overlaps existing: ${overlaps.join(", ")}.` : ""
  return ok(`Zone saved.${overlapNote}`)
}

export async function setResponderDuty(
  responderId: string,
  onDuty: boolean,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(responderId)
  if (!parsed.success) return fail("Invalid responder")
  const admin = createAdminSupabase()
  const { error } = await admin
    .from("responders")
    .update({ on_duty: onDuty })
    .eq("id", parsed.data)
  if (error) return fail(error.message)
  await writeAudit({
    action: onDuty ? "responder.on_duty" : "responder.off_duty",
    entity: "responders",
    entityId: parsed.data,
    after: { on_duty: onDuty },
  })
  revalidatePath("/responders")
  revalidatePath("/dashboard")
  return ok(onDuty ? "On duty" : "Off duty")
}

export type IntegrityProof = {
  status: "verified" | "broken" | "offline"
  recordHash: string
  blockNumber: number | null
  explorerUrl: string | null
  reason?: string
}

export async function verifyIncidentProof(
  incidentId: string,
): Promise<IntegrityProof> {
  const parsed = z.string().uuid().safeParse(incidentId)
  if (!parsed.success) {
    return {
      status: "offline",
      recordHash: "0x",
      blockNumber: null,
      explorerUrl: null,
      reason: "Invalid incident id",
    }
  }
  const incident = await fetchIncidentById(parsed.data)
  if (!incident || incident.lat === null || incident.lon === null) {
    return {
      status: "offline",
      recordHash: "0x",
      blockNumber: null,
      explorerUrl: null,
      reason: "Incident missing coordinates",
    }
  }
  const { incidentRecordHash } = await import("@sts/shared")
  const { verifyIntegrity } = await import("@/lib/chain/anchor")
  const { explorerAddressUrl, incidentAnchorAddress } = await import(
    "@/lib/chain/config"
  )
  const recordHash = incidentRecordHash({
    id: incident.id,
    tourist_token_id: incident.tourist_token_id,
    type: incident.type,
    severity: incident.severity,
    occurred_at: incident.occurred_at,
    lat: incident.lat,
    lon: incident.lon,
    zone_id: incident.zone_id,
    detected_by: incident.detected_by,
    payload: incident.payload,
  })
  try {
    const result = await verifyIntegrity(incident.id, recordHash)
    if (result.matched) {
      return {
        status: "verified",
        recordHash,
        blockNumber: incident.anchor_block,
        explorerUrl:
          explorerAddressUrl(incidentAnchorAddress()) ??
          (incident.anchor_tx
            ? `https://amoy.polygonscan.com/tx/${incident.anchor_tx}`
            : null),
      }
    }
    return {
      status: "broken",
      recordHash,
      blockNumber: incident.anchor_block,
      explorerUrl: explorerAddressUrl(incidentAnchorAddress()),
      reason: "No on-chain anchor matches the recomputed hash",
    }
  } catch (error) {
    return {
      status: "offline",
      recordHash,
      blockNumber: incident.anchor_block,
      explorerUrl: null,
      reason: error instanceof Error ? error.message : "Chain unreachable",
    }
  }
}

export async function verifyTokenOnChain(tokenId: string) {
  const { verifyIdentity } = await import("@/lib/chain/registry")
  const { explorerTokenUrl } = await import("@/lib/chain/config")
  try {
    const id = BigInt(tokenId)
    const result = await verifyIdentity(id)
    return {
      ok: true as const,
      valid: result.valid,
      status: Number(result.status),
      validUntil: Number(result.validUntil),
      commitment: result.commitment,
      explorerUrl: explorerTokenUrl(id),
    }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Chain unreachable",
    }
  }
}
