// packages/shared/src/schemas/incident.ts
import { z } from "zod"
import { latitudeSchema, longitudeSchema, timestamptzSchema, uuidSchema } from "./coords"
import {
  detectionSourceSchema,
  dispatchStatusSchema,
  incidentStatusSchema,
  incidentTypeSchema,
  severityLevelSchema,
} from "./enums"

export const incidentSchema = z.object({
  id: uuidSchema,
  tourist_id: uuidSchema.nullable(),
  type: incidentTypeSchema,
  severity: severityLevelSchema,
  status: incidentStatusSchema.default("open"),
  detected_by: detectionSourceSchema.default("rules"),
  lat: latitudeSchema.nullable(),
  lon: longitudeSchema.nullable(),
  zone_id: uuidSchema.nullable(),
  address_text: z.string().nullable().optional(),
  anomaly_score: z.number().min(0).max(1).nullable().optional(),
  safety_score_at: z.number().int().min(0).max(100).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  ai_brief: z.string().nullable().optional(),
  ai_brief_model: z.string().nullable().optional(),
  occurred_at: timestamptzSchema,
  acknowledged_at: timestamptzSchema.nullable().optional(),
  resolved_at: timestamptzSchema.nullable().optional(),
  resolution_notes: z.string().nullable().optional(),
  record_hash: z.string().nullable().optional(),
})
export type Incident = z.infer<typeof incidentSchema>

export const dispatchSchema = z.object({
  id: uuidSchema,
  incident_id: uuidSchema,
  responder_id: uuidSchema,
  status: dispatchStatusSchema.default("sent"),
  distance_m: z.number().nullable().optional(),
  eta_seconds: z.number().int().nullable().optional(),
  sent_at: timestamptzSchema.optional(),
  acknowledged_at: timestamptzSchema.nullable().optional(),
  arrived_at: timestamptzSchema.nullable().optional(),
  completed_at: timestamptzSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
})
export type Dispatch = z.infer<typeof dispatchSchema>
