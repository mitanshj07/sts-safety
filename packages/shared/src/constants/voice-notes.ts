// packages/shared/src/constants/voice-notes.ts
// Browser MediaRecorder + private Supabase Storage. No paid STT/TTS vendor.

export const VOICE_NOTE_BUCKET = "incident-voice" as const

export const SOS_MESSAGE_MAX_LENGTH = 280

export const VOICE_NOTE_MAX_DURATION_MS = 45_000

export const VOICE_NOTE_MAX_BYTES = 1_048_576

export const VOICE_NOTE_ALLOWED_MIME = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",
] as const

export type VoiceNoteMime = (typeof VOICE_NOTE_ALLOWED_MIME)[number]

export const INCIDENT_MESSAGE_KINDS = ["text", "voice"] as const
export type IncidentMessageKind = (typeof INCIDENT_MESSAGE_KINDS)[number]

export const INCIDENT_MESSAGE_SENDERS = ["tourist", "command"] as const
export type IncidentMessageSender = (typeof INCIDENT_MESSAGE_SENDERS)[number]

export function normalizeAudioMime(raw: string | null | undefined): string {
  const base = (raw ?? "").split(";")[0]?.trim().toLowerCase() ?? ""
  if (base === "audio/x-wav") return "audio/wav"
  if (base === "audio/m4a") return "audio/mp4"
  return base
}

export function isAllowedVoiceMime(raw: string | null | undefined): boolean {
  const mime = normalizeAudioMime(raw)
  return (VOICE_NOTE_ALLOWED_MIME as readonly string[]).includes(mime)
}

export function voiceExtension(raw: string | null | undefined): string {
  switch (normalizeAudioMime(raw)) {
    case "audio/ogg":
      return "ogg"
    case "audio/mp4":
    case "audio/x-m4a":
    case "audio/aac":
      return "m4a"
    case "audio/mpeg":
      return "mp3"
    case "audio/wav":
      return "wav"
    default:
      return "webm"
  }
}

export function touristSosMessage(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null
  const raw = payload.tourist_message
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.slice(0, SOS_MESSAGE_MAX_LENGTH)
}

export function formatVoiceDuration(durationMs: number | null | undefined): string {
  const ms = Math.max(0, durationMs ?? 0)
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, "0")}`
}
