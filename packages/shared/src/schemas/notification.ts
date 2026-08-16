// packages/shared/src/schemas/notification.ts
import { z } from "zod"
import { timestamptzSchema, uuidSchema } from "./coords"
import { notifyChannelSchema, notifyStatusSchema, severityLevelSchema } from "./enums"

export const notificationPayloadSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  locale: z.string().default("en"),
  incident_id: uuidSchema.optional(),
  severity: severityLevelSchema.optional(),
  url: z.string().optional(),
  tag: z.string().optional(),
  data: z.record(z.string(), z.string()).optional(),
})
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>

export const notificationRecordSchema = notificationPayloadSchema.extend({
  id: z.number().int().optional(),
  recipient_kind: z.enum(["tourist", "responder", "authority", "emergency_contact"]),
  recipient_id: uuidSchema.nullable().optional(),
  channel: notifyChannelSchema,
  status: notifyStatusSchema.default("queued"),
  provider_ref: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  attempts: z.number().int().min(0).default(0),
  created_at: timestamptzSchema.optional(),
  delivered_at: timestamptzSchema.nullable().optional(),
})
export type NotificationRecord = z.infer<typeof notificationRecordSchema>
export type RecipientKind = NotificationRecord["recipient_kind"]
