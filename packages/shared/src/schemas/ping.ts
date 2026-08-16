// packages/shared/src/schemas/ping.ts
import { z } from "zod"
import { latitudeSchema, longitudeSchema, timestamptzSchema, uuidSchema } from "./coords"
import { pingSourceSchema } from "./enums"

export const locationPingSchema = z.object({
  id: z.number().int().optional(),
  tourist_id: uuidSchema,
  lat: latitudeSchema,
  lon: longitudeSchema,
  accuracy_m: z.number().positive().optional(),
  altitude_m: z.number().optional(),
  speed_mps: z.number().min(0).optional(),
  heading_deg: z.number().min(0).max(360).optional(),
  battery_pct: z.number().int().min(0).max(100).optional(),
  source: pingSourceSchema.default("phone"),
  is_mock: z.boolean().default(false),
  recorded_at: timestamptzSchema,
})
export type LocationPing = z.infer<typeof locationPingSchema>
