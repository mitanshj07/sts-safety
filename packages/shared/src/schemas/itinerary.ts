// packages/shared/src/schemas/itinerary.ts
import { z } from "zod"
import {
  latitudeSchema,
  longitudeSchema,
  lonLatTupleSchema,
  timestamptzSchema,
  uuidSchema,
} from "./coords"

export const waypointSchema = z.object({
  name: z.string().min(1),
  lat: latitudeSchema,
  lon: longitudeSchema,
  eta: timestamptzSchema.optional(),
  dwell_minutes: z.number().int().min(0).optional(),
  checkin_required: z.boolean().optional(),
})
export type Waypoint = z.infer<typeof waypointSchema>

export const lineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(lonLatTupleSchema).min(2),
})

export const itinerarySchema = z.object({
  id: uuidSchema.optional(),
  tourist_id: uuidSchema,
  title: z.string().min(1).default("Planned route"),
  path: lineStringSchema,
  corridor_m: z.number().int().positive().default(2000),
  waypoints: z.array(waypointSchema).default([]),
  starts_at: timestamptzSchema,
  ends_at: timestamptzSchema,
  active: z.boolean().default(true),
  created_at: timestamptzSchema.optional(),
})
export type Itinerary = z.infer<typeof itinerarySchema>
