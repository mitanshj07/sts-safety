import { createAdminClient } from "@/lib/supabase/admin"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { dispatchIncidentNotifications } from "@/lib/notify/dispatcher"
import { jsonError } from "@/lib/notify/http"
import { pipelineIncidentSchema } from "@/lib/notify/schemas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(request: Request): Promise<Response> {
  let principal
  try {
    principal = await requireRole(request, ["tourist"])
  } catch (error) {
    return jsonAuthError(error)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("invalid json", 400)
  }
  const parsed = pipelineIncidentSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "invalid body", 400)
  }

  const admin = createAdminClient()
  const { data: tourist } = await admin
    .from("tourists")
    .select("id")
    .eq("profile_id", principal.id)
    .maybeSingle()
  if (!tourist) {
    return jsonError("tourist profile missing", 403)
  }

  const { data: incident } = await admin
    .from("incidents")
    .select("id, tourist_id")
    .eq("id", parsed.data.incident_id)
    .maybeSingle()
  if (!incident || incident.tourist_id !== tourist.id) {
    return jsonError("incident not found", 404)
  }

  try {
    const result = await dispatchIncidentNotifications(parsed.data.incident_id)
    return Response.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "dispatch failed"
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
