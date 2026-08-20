// apps/web/src/lib/incidents/messages-client.ts
"use client"

import type { IncidentMessage, IncidentMessageKind } from "@sts/shared"
import { getBrowserSupabase } from "@/lib/supabase/client"

export async function fetchIncidentMessages(
  incidentId: string,
): Promise<IncidentMessage[]> {
  const supabase = getBrowserSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from("incident_messages")
    .select(
      "id, incident_id, sender_kind, sender_id, kind, body, storage_path, mime_type, duration_ms, byte_size, created_at",
    )
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true })
  if (error || !data) return []
  return data.map((row) => ({
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

export async function postIncidentMessage(input: {
  incidentId: string
  kind: IncidentMessageKind
  body?: string
  file?: Blob
  durationMs?: number
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const form = new FormData()
  form.set("incident_id", input.incidentId)
  form.set("kind", input.kind)
  if (input.body) form.set("body", input.body)
  if (typeof input.durationMs === "number") {
    form.set("duration_ms", String(Math.round(input.durationMs)))
  }
  if (input.file) {
    const name = input.file.type.includes("mp4") ? "note.m4a" : "note.webm"
    form.set("file", input.file, name)
  }
  const response = await fetch("/api/incidents/messages", {
    method: "POST",
    body: form,
    credentials: "include",
  })
  const json = (await response.json().catch(() => null)) as
    | { ok?: boolean; id?: string; error?: string }
    | null
  if (!response.ok || !json?.ok || !json.id) {
    return { ok: false, error: json?.error ?? `Send failed (${response.status})` }
  }
  return { ok: true, id: json.id }
}

export async function fetchVoicePlaybackUrl(messageId: string): Promise<string | null> {
  const response = await fetch(`/api/incidents/messages/${messageId}/audio`, {
    credentials: "include",
  })
  if (!response.ok) return null
  const json = (await response.json().catch(() => null)) as { url?: string } | null
  return typeof json?.url === "string" ? json.url : null
}
