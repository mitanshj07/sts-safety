// apps/web/src/app/api/incidents/messages/route.ts
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { jsonError } from "@/lib/notify/http"
import { clientKey, rateLimit, rateLimitResponse } from "@/lib/security/rate-limit"
import {
  assertCanAccessIncident,
  insertIncidentMessage,
  loadIncidentForMessages,
} from "@/lib/incidents/voice-server"
import {
  COMMAND_NOTE_MAX_LENGTH,
  SOS_MESSAGE_MAX_LENGTH,
  VOICE_NOTE_MAX_BYTES,
  incidentMessageKindSchema,
  uuidSchema,
} from "@sts/shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(request: Request): Promise<Response> {
  let principal
  try {
    principal = await requireRole(request, ["tourist", "admin", "responder", "auditor"])
  } catch (error) {
    return jsonAuthError(error)
  }

  const limited = rateLimit({
    key: `incident-msg:${clientKey(request)}`,
    capacity: 20,
    refillPerSec: 0.25,
  })
  if (!limited.ok) return rateLimitResponse(limited)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonError("invalid form data", 400)
  }

  const incidentParsed = uuidSchema.safeParse(form.get("incident_id"))
  if (!incidentParsed.success) return jsonError("invalid incident id", 400)
  const kindParsed = incidentMessageKindSchema.safeParse(form.get("kind") ?? "text")
  if (!kindParsed.success) return jsonError("invalid message kind", 400)

  const incident = await loadIncidentForMessages(incidentParsed.data)
  if (!incident) return jsonError("incident not found", 404)

  const access = await assertCanAccessIncident({
    role: principal.role,
    profileId: principal.id,
    incident,
  })
  if ("error" in access) return jsonError(access.error, access.status)

  const rawBody = String(form.get("body") ?? "").trim()
  const body =
    kindParsed.data === "text"
      ? rawBody.slice(0, access.senderKind === "tourist" ? SOS_MESSAGE_MAX_LENGTH : COMMAND_NOTE_MAX_LENGTH)
      : rawBody.slice(0, COMMAND_NOTE_MAX_LENGTH) || null

  let audio: { bytes: Uint8Array; mimeType: string; durationMs: number } | null = null
  if (kindParsed.data === "voice") {
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return jsonError("voice file missing", 400)
    }
    if (file.size > VOICE_NOTE_MAX_BYTES) {
      return jsonError("Voice note is too large (max 1 MB)", 400)
    }
    const durationMs = Number.parseInt(String(form.get("duration_ms") ?? "0"), 10)
    const bytes = new Uint8Array(await file.arrayBuffer())
    audio = {
      bytes,
      mimeType: file.type || "audio/webm",
      durationMs: Number.isFinite(durationMs) ? durationMs : 0,
    }
  }

  const result = await insertIncidentMessage({
    incident,
    senderKind: access.senderKind,
    senderId: access.senderId,
    actorLabel:
      access.senderKind === "command"
        ? `command-dashboard:${principal.role}`
        : "tourist",
    kind: kindParsed.data,
    body,
    audio,
  })
  if (!result.ok) return jsonError(result.error, 400)

  if (access.senderKind === "command") {
    try {
      const { dispatchTouristNote } = await import("@/lib/notify/dispatcher")
      await dispatchTouristNote({
        incidentId: incident.id,
        body:
          result.message.kind === "voice"
            ? result.message.body ?? "Voice note from the control room."
            : result.message.body ?? "Note from the control room.",
        actorLabel: `command-dashboard:${principal.role}`,
      })
    } catch {
      // Thread row already landed; push is best-effort.
    }
  }

  return Response.json({ ok: true, id: result.message.id, message: result.message })
}
