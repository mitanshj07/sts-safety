// packages/shared/src/schemas/incident-message.ts
import { z } from "zod"
import { timestamptzSchema, uuidSchema } from "./coords"
import {
  INCIDENT_MESSAGE_KINDS,
  INCIDENT_MESSAGE_SENDERS,
  SOS_MESSAGE_MAX_LENGTH,
  VOICE_NOTE_MAX_BYTES,
  VOICE_NOTE_MAX_DURATION_MS,
} from "../constants/voice-notes"

export const incidentMessageKindSchema = z.enum(INCIDENT_MESSAGE_KINDS)
export const incidentMessageSenderSchema = z.enum(INCIDENT_MESSAGE_SENDERS)

export const incidentMessageSchema = z.object({
  id: uuidSchema,
  incident_id: uuidSchema,
  sender_kind: incidentMessageSenderSchema,
  sender_id: uuidSchema.nullable().optional(),
  kind: incidentMessageKindSchema,
  body: z.string().nullable().optional(),
  storage_path: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  duration_ms: z.number().int().nullable().optional(),
  byte_size: z.number().int().nullable().optional(),
  created_at: timestamptzSchema,
})
export type IncidentMessage = z.infer<typeof incidentMessageSchema>

export const sosOptionalMessageSchema = z
  .string()
  .trim()
  .max(SOS_MESSAGE_MAX_LENGTH)
  .optional()

export const voiceNoteMetaSchema = z.object({
  duration_ms: z.number().int().min(250).max(VOICE_NOTE_MAX_DURATION_MS),
  byte_size: z.number().int().min(1).max(VOICE_NOTE_MAX_BYTES),
  mime_type: z.string().min(1).max(80),
})
