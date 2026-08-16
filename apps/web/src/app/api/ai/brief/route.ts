// apps/web/src/app/api/ai/brief/route.ts
import { z } from "zod"

import { generateIncidentNarrative } from "@/lib/ai/brief"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { appendIncidentEvent, writeAudit } from "@/lib/command/audit"
import { fetchIncidentById } from "@/lib/command/queries"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 30

const bodySchema = z.object({
  incident_id: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
}).refine((v) => Boolean(v.incident_id || v.incidentId), {
  message: "incident_id required",
})

export async function POST(request: Request): Promise<Response> {
  try {
    await requireRole(request, ["admin", "responder"])
  } catch (error) {
    return jsonAuthError(error)
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const incidentId = parsed.data.incident_id ?? parsed.data.incidentId
  if (!incidentId) {
    return Response.json({ ok: false, error: "incident_id required" }, { status: 400 })
  }

  const incident = await fetchIncidentById(incidentId)
  if (!incident) {
    return Response.json({ ok: false, error: "incident_not_found" }, { status: 404 })
  }

  const narrative = await generateIncidentNarrative(incident, "brief")
  const admin = createAdminClient()
  const { error } = await admin
    .from("incidents")
    .update({
      ai_brief: narrative.text,
      ai_brief_model: narrative.model,
      updated_at: new Date().toISOString(),
    })
    .eq("id", incidentId)
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  await appendIncidentEvent({
    incidentId,
    eventType: "note",
    actorLabel: "api",
    detail: { kind: "ai_brief", model: narrative.model, fallback_used: narrative.fallbackUsed },
  })
  await writeAudit({
    action: "incident.regenerate_brief",
    entity: "incidents",
    entityId: incidentId,
    after: { model: narrative.model },
  })

  return Response.json({
    ok: true,
    incident_id: incidentId,
    brief: narrative.text,
    model: narrative.model,
    fallback_used: narrative.fallbackUsed,
    latency_ms: narrative.latencyMs,
    input_tokens: narrative.inputTokens,
    output_tokens: narrative.outputTokens,
  })
}
