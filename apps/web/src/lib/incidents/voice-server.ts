// apps/web/src/lib/incidents/voice-server.ts
import "server-only"

import {
  COMMAND_NOTE_MAX_LENGTH,
  SOS_MESSAGE_MAX_LENGTH,
  VOICE_NOTE_MAX_BYTES,
  VOICE_NOTE_MAX_DURATION_MS,
  formatVoiceDuration,
  isAllowedVoiceMime,
  normalizeAudioMime,
  touristSosMessage,
  voiceExtension,
  type IncidentMessageKind,
  type IncidentMessageSender,
} from "@sts/shared"

import { storageBuckets } from "@/lib/chain/env"
import { isStaffRole, type UserRole } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { broadcastIncident } from "@/lib/notify/channels/realtime"

export type StoredIncidentMessage = {
  id: string
  incident_id: string
  sender_kind: IncidentMessageSender
  sender_id: string | null
  kind: IncidentMessageKind
  body: string | null
  storage_path: string | null
  mime_type: string | null
  duration_ms: number | null
  byte_size: number | null
  created_at: string
}

type IncidentAccess = {
  id: string
  tourist_id: string | null
  type: string
  status: string
  severity: string
  payload: Record<string, unknown>
}

export async function loadIncidentForMessages(
  incidentId: string,
): Promise<IncidentAccess | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("incidents")
    .select("id, tourist_id, type, status, severity, payload")
    .eq("id", incidentId)
    .maybeSingle()
  if (!data) return null
  return {
    id: String(data.id),
    tourist_id: typeof data.tourist_id === "string" ? data.tourist_id : null,
    type: String(data.type),
    status: String(data.status),
    severity: String(data.severity ?? "high"),
    payload:
      data.payload && typeof data.payload === "object" && !Array.isArray(data.payload)
        ? (data.payload as Record<string, unknown>)
        : {},
  }
}

export async function touristIdForProfile(profileId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("tourists")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle()
  return typeof data?.id === "string" ? data.id : null
}

export async function assertCanAccessIncident(input: {
  role: UserRole
  profileId: string
  incident: IncidentAccess
}): Promise<{ senderKind: IncidentMessageSender; senderId: string | null } | { error: string; status: number }> {
  if (isStaffRole(input.role)) {
    return { senderKind: "command", senderId: input.profileId }
  }
  if (input.role !== "tourist") {
    return { error: "forbidden", status: 403 }
  }
  const touristId = await touristIdForProfile(input.profileId)
  if (!touristId || input.incident.tourist_id !== touristId) {
    return { error: "incident not found", status: 404 }
  }
  return { senderKind: "tourist", senderId: touristId }
}

async function ensureVoiceBucket(): Promise<string> {
  const bucket = storageBuckets().voice
  const admin = createAdminClient()
  try {
    await admin.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: VOICE_NOTE_MAX_BYTES,
    })
  } catch {
    // Already created by migration, or Storage will reject the upload with a clearer error.
  }
  return bucket
}

async function appendMessageEvent(input: {
  incidentId: string
  actorLabel: string
  actorId?: string | null
  detail: Record<string, unknown>
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from("incident_events").insert({
    incident_id: input.incidentId,
    event_type: "message",
    actor_label: input.actorLabel,
    actor_id: input.actorId ?? null,
    detail: input.detail,
  })
}

export async function insertIncidentMessage(input: {
  incident: IncidentAccess
  senderKind: IncidentMessageSender
  senderId: string | null
  actorLabel: string
  kind: IncidentMessageKind
  body?: string | null
  audio?: { bytes: Uint8Array; mimeType: string; durationMs: number } | null
}): Promise<{ ok: true; message: StoredIncidentMessage } | { ok: false; error: string }> {
  const admin = createAdminClient()
  let storagePath: string | null = null
  let mimeType: string | null = null
  let durationMs: number | null = null
  let byteSize: number | null = null
  let body = input.body?.trim() || null

  if (input.kind === "text") {
    if (!body) return { ok: false, error: "Message is empty" }
    if (body.length > COMMAND_NOTE_MAX_LENGTH) {
      body = body.slice(0, COMMAND_NOTE_MAX_LENGTH)
    }
  } else {
    const audio = input.audio
    if (!audio) return { ok: false, error: "Voice note is missing" }
    if (audio.bytes.byteLength > VOICE_NOTE_MAX_BYTES) {
      return { ok: false, error: "Voice note is too large (max 1 MB)" }
    }
    if (audio.durationMs > VOICE_NOTE_MAX_DURATION_MS) {
      return { ok: false, error: "Voice note is longer than 45 seconds" }
    }
    if (audio.durationMs < 250) {
      return { ok: false, error: "Voice note is too short" }
    }
    if (!isAllowedVoiceMime(audio.mimeType)) {
      return { ok: false, error: "Unsupported audio type" }
    }
    mimeType = normalizeAudioMime(audio.mimeType)
    durationMs = audio.durationMs
    byteSize = audio.bytes.byteLength
    const touristFolder = input.incident.tourist_id ?? "unknown"
    const id = crypto.randomUUID()
    storagePath = `${touristFolder}/${input.incident.id}/${id}.${voiceExtension(mimeType)}`
    const bucket = await ensureVoiceBucket()
    const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, audio.bytes, {
      contentType: mimeType,
      upsert: false,
    })
    if (uploadError) return { ok: false, error: uploadError.message }
    if (!body) {
      body = `Voice note (${formatVoiceDuration(durationMs)})`
    }
  }

  const { data, error } = await admin
    .from("incident_messages")
    .insert({
      incident_id: input.incident.id,
      sender_kind: input.senderKind,
      sender_id: input.senderId,
      kind: input.kind,
      body,
      storage_path: storagePath,
      mime_type: mimeType,
      duration_ms: durationMs,
      byte_size: byteSize,
    })
    .select(
      "id, incident_id, sender_kind, sender_id, kind, body, storage_path, mime_type, duration_ms, byte_size, created_at",
    )
    .maybeSingle()
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to store message" }
  }

  const message: StoredIncidentMessage = {
    id: String(data.id),
    incident_id: String(data.incident_id),
    sender_kind: data.sender_kind === "command" ? "command" : "tourist",
    sender_id: typeof data.sender_id === "string" ? data.sender_id : null,
    kind: data.kind === "voice" ? "voice" : "text",
    body: typeof data.body === "string" ? data.body : null,
    storage_path: typeof data.storage_path === "string" ? data.storage_path : null,
    mime_type: typeof data.mime_type === "string" ? data.mime_type : null,
    duration_ms: typeof data.duration_ms === "number" ? data.duration_ms : null,
    byte_size: typeof data.byte_size === "number" ? data.byte_size : null,
    created_at: String(data.created_at),
  }

  await appendMessageEvent({
    incidentId: input.incident.id,
    actorLabel: input.actorLabel,
    actorId: input.senderKind === "command" ? input.senderId : null,
    detail: {
      message_id: message.id,
      kind: message.kind,
      sender_kind: message.sender_kind,
      body: message.kind === "text" ? message.body : null,
      duration_ms: message.duration_ms,
    },
  })

  await broadcastIncident({
    kind: "note",
    incident_id: input.incident.id,
    tourist_id: input.incident.tourist_id,
    status: input.incident.status,
    severity: input.incident.severity,
    type: input.incident.type,
    actor_label: input.actorLabel,
    at: message.created_at,
    title: input.senderKind === "command" ? "Control room" : "Tourist",
    body: message.body ?? (message.kind === "voice" ? "Voice note" : ""),
    message_kind: message.kind,
    message_id: message.id,
    sender_kind: message.sender_kind,
    duration_ms: message.duration_ms,
  })

  return { ok: true, message }
}

export async function signedVoiceUrl(storagePath: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(storageBuckets().voice)
    .createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function listIncidentMessages(
  incidentId: string,
): Promise<StoredIncidentMessage[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("incident_messages")
    .select(
      "id, incident_id, sender_kind, sender_id, kind, body, storage_path, mime_type, duration_ms, byte_size, created_at",
    )
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true })
  return (data ?? []).map((row) => ({
    id: String(row.id),
    incident_id: String(row.incident_id),
    sender_kind: row.sender_kind === "command" ? "command" : "tourist",
    sender_id: typeof row.sender_id === "string" ? row.sender_id : null,
    kind: row.kind === "voice" ? "voice" : "text",
    body: typeof row.body === "string" ? row.body : null,
    storage_path: typeof row.storage_path === "string" ? row.storage_path : null,
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    duration_ms: typeof row.duration_ms === "number" ? row.duration_ms : null,
    byte_size: typeof row.byte_size === "number" ? row.byte_size : null,
    created_at: String(row.created_at),
  }))
}

export { SOS_MESSAGE_MAX_LENGTH, touristSosMessage }
