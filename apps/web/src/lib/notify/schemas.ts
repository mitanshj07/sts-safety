// apps/web/src/lib/notify/schemas.ts
import { z } from "zod";
import {
  incidentTypeSchema,
  notifyChannelSchema,
  severityLevelSchema,
  uuidSchema,
} from "@sts/shared";

export const recipientKindSchema = z.enum([
  "tourist",
  "responder",
  "authority",
  "emergency_contact",
]);

export const notifyLocaleSchema = z.enum(["en", "hi", "as", "bn", "ne"]);

export const pipelineIncidentSchema = z.object({
  incident_id: uuidSchema,
  type: incidentTypeSchema.optional(),
  severity: severityLevelSchema.optional(),
});

export const dispatchAckBodySchema = z.object({
  incidentId: uuidSchema,
  actorLabel: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export const dispatchResolveBodySchema = z.object({
  incidentId: uuidSchema,
  notes: z.string().min(1).max(4000),
  actorLabel: z.string().max(120).optional(),
});

export const nearestResponderRowSchema = z.object({
  responder_id: uuidSchema,
  name: z.string(),
  distance_m: z.number(),
  telegram_chat_id: z.string().nullable().optional(),
});

export const telegramUserSchema = z.object({
  id: z.number(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export const telegramCallbackQuerySchema = z.object({
  id: z.string(),
  from: telegramUserSchema,
  data: z.string().min(1).max(64),
  message: z
    .object({
      message_id: z.number(),
      chat: z.object({ id: z.number() }),
      caption: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  callback_query: telegramCallbackQuerySchema.optional(),
});

export const telegramCallbackDataSchema = z
  .string()
  .regex(/^[adr]:[0-9a-fA-F-]{36}$/);

export const enabledChannelListSchema = z.array(notifyChannelSchema);

export type PipelineIncidentBody = z.infer<typeof pipelineIncidentSchema>;
export type DispatchAckBody = z.infer<typeof dispatchAckBodySchema>;
export type DispatchResolveBody = z.infer<typeof dispatchResolveBodySchema>;
