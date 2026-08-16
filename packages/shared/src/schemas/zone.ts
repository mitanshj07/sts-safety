// packages/shared/src/schemas/zone.ts
import { z } from "zod"
import { lonLatTupleSchema, timestamptzSchema, uuidSchema } from "./coords"
import { riskLevelSchema, zoneCategorySchema } from "./enums"

export const timeWindowSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1),
  from: z.iso.time(),
  to: z.iso.time(),
  risk_level: riskLevelSchema,
})
export type TimeWindow = z.infer<typeof timeWindowSchema>

export const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(lonLatTupleSchema).min(4)).min(1),
})

export const zoneSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  name_local: z.record(z.string(), z.string()).default({}),
  description: z.string().nullable(),
  category: zoneCategorySchema,
  risk_level: riskLevelSchema,
  geom: polygonSchema,
  time_windows: z.array(timeWindowSchema).default([]),
  requires_permit: z.boolean().default(false),
  advisory_text: z.string().nullable(),
  state_code: z.string().nullable(),
  district: z.string().nullable(),
  active: z.boolean().default(true),
  created_by: uuidSchema.nullable().optional(),
  created_at: timestamptzSchema.optional(),
  updated_at: timestamptzSchema.optional(),
})
export type Zone = z.infer<typeof zoneSchema>
