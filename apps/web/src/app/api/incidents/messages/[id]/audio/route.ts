// apps/web/src/app/api/incidents/messages/[id]/audio/route.ts
import { z } from "zod"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { jsonError } from "@/lib/notify/http"
import {
  assertCanAccessIncident,
  loadIncidentForMessages,
  signedVoiceUrl,
} from "@/lib/incidents/voice-server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteProps = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteProps): Promise<Response> {
  let principal
  try {
    principal = await requireRole(request, ["tourist", "admin", "responder", "auditor"])
  } catch (error) {
    return jsonAuthError(error)
  }

  const { id } = await params
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return jsonError("invalid message id", 400)

  const admin = createAdminClient()
  const { data } = await admin
    .from("incident_messages")
    .select("id, incident_id, kind, storage_path")
    .eq("id", parsed.data)
    .maybeSingle()
  if (!data || data.kind !== "voice" || typeof data.storage_path !== "string") {
    return jsonError("voice note not found", 404)
  }

  const incident = await loadIncidentForMessages(String(data.incident_id))
  if (!incident) return jsonError("incident not found", 404)
  const access = await assertCanAccessIncident({
    role: principal.role,
    profileId: principal.id,
    incident,
  })
  if ("error" in access) return jsonError(access.error, access.status)

  const url = await signedVoiceUrl(data.storage_path)
  if (!url) return jsonError("could not sign audio url", 500)
  return Response.json({ ok: true, url })
}
