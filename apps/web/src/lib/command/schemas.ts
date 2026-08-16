// apps/web/src/lib/command/schemas.ts
import { z } from "zod"
import {
  detectionSourceSchema,
  dispatchStatusSchema,
  idStatusSchema,
  incidentStatusSchema,
  incidentTypeSchema,
  riskLevelSchema,
  severityLevelSchema,
  uuidSchema,
  zoneCategorySchema,
} from "@sts/shared"

export const jsonRecordSchema = z.record(z.string(), z.unknown())

export const liveTouristSchema = z.object({
  id: uuidSchema,
  full_name: z.string(),
  nationality: z.string(),
  safety_score: z.number().int(),
  last_ping_at: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  current_zone_ids: z.array(z.string()).default([]),
  token_id: z.union([z.string(), z.number()]).nullable().optional(),
  id_status: idStatusSchema.nullable().optional(),
  open_incidents: z.number().optional(),
  photo_path: z.string().nullable().optional(),
  phone_e164: z.string().nullable().optional(),
  status: z.string().optional(),
})

export const liveIncidentSchema = z.object({
  id: uuidSchema,
  tourist_id: uuidSchema.nullable(),
  type: incidentTypeSchema,
  severity: severityLevelSchema,
  status: incidentStatusSchema,
  detected_by: detectionSourceSchema,
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  zone_id: uuidSchema.nullable(),
  address_text: z.string().nullable(),
  anomaly_score: z.number().nullable(),
  safety_score_at: z.number().nullable(),
  payload: jsonRecordSchema.default({}),
  ai_brief: z.string().nullable(),
  ai_brief_model: z.string().nullable(),
  occurred_at: z.string(),
  acknowledged_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolution_notes: z.string().nullable().optional(),
  record_hash: z.string().nullable(),
  tourist_name: z.string().nullable(),
  nationality: z.string().nullable(),
  tourist_phone: z.string().nullable().optional(),
  tourist_photo: z.string().nullable().optional(),
  zone_name: z.string().nullable(),
  zone_category: zoneCategorySchema.nullable(),
  anchor_tx: z.string().nullable(),
  anchor_status: z.string().nullable(),
  anchor_block: z.number().nullable().optional(),
  tourist_token_id: z.union([z.string(), z.number()]).nullable().optional(),
})

export const liveDispatchSchema = z.object({
  id: uuidSchema,
  incident_id: uuidSchema,
  responder_id: uuidSchema,
  responder_name: z.string().nullable().optional(),
  status: dispatchStatusSchema,
  distance_m: z.number().nullable(),
  eta_seconds: z.number().nullable(),
  sent_at: z.string(),
  acknowledged_at: z.string().nullable().optional(),
})

export const incidentEventSchema = z.object({
  id: z.number().int(),
  incident_id: uuidSchema,
  event_type: z.string(),
  actor_id: uuidSchema.nullable(),
  actor_label: z.string().nullable(),
  detail: jsonRecordSchema.default({}),
  created_at: z.string(),
})

export const acknowledgeSchema = z.object({
  incidentId: uuidSchema,
})

export const escalateSchema = z.object({
  incidentId: uuidSchema,
  notes: z.string().max(2000).optional(),
})

export const resolveSchema = z.object({
  incidentId: uuidSchema,
  notes: z.string().min(1).max(4000),
})

export const falsePositiveSchema = z.object({
  incidentId: uuidSchema,
  notes: z.string().max(2000).optional(),
})

export const dispatchSchema = z.object({
  incidentId: uuidSchema,
  responderId: uuidSchema,
})

export const regenerateBriefSchema = z.object({
  incidentId: uuidSchema,
})

export const generateEfirSchema = z.object({
  incidentId: uuidSchema,
})

export const saveZoneSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1).max(120),
  category: zoneCategorySchema,
  risk_level: riskLevelSchema,
  description: z.string().max(2000).optional(),
  state_code: z.string().max(8).optional(),
  district: z.string().max(80).optional(),
  requires_permit: z.boolean().default(false),
  advisory_text: z.string().max(2000).optional(),
  time_windows: z
    .array(
      z.object({
        days: z.array(z.number().int().min(0).max(6)).min(1),
        from: z.string().regex(/^\d{2}:\d{2}$/),
        to: z.string().regex(/^\d{2}:\d{2}$/),
        risk_level: riskLevelSchema,
      }),
    )
    .default([]),
  geom: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1),
  }),
})

export const qrPayloadSchema = z.union([
  z.object({
    tokenId: z.union([z.string(), z.number()]),
    chainId: z.number().optional(),
    contract: z.string().optional(),
  }),
  z.object({
    token_id: z.union([z.string(), z.number()]),
  }),
  z.object({
    v: z.number().optional(),
    t: z.union([z.string(), z.number()]),
  }),
])

export const actionResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), message: z.string().optional() }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

export type ActionResult = z.infer<typeof actionResultSchema>
