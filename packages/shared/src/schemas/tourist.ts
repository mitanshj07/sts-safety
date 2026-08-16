// packages/shared/src/schemas/tourist.ts
import { z } from "zod"
import { latitudeSchema, longitudeSchema, timestamptzSchema, uuidSchema } from "./coords"
import { kycTypeSchema, touristStatusSchema } from "./enums"

export const emergencyContactSchema = z.object({
  name: z.string().min(1),
  relation: z.string().min(1),
  phone_e164: z.string().min(1),
  email: z.email().optional(),
  notify: z.boolean().default(true),
})
export type EmergencyContact = z.infer<typeof emergencyContactSchema>

export const touristCreateSchema = z.object({
  full_name: z.string().min(1),
  nationality: z.string().length(2).overwrite((s) => s.toUpperCase()),
  date_of_birth: z.iso.date().optional(),
  kyc_type: kycTypeSchema,
  kyc_number: z.string().min(4),
  phone_e164: z.string().optional(),
  email: z.email().optional(),
  emergency_contacts: z.array(emergencyContactSchema).default([]),
  trip_start: timestamptzSchema,
  trip_end: timestamptzSchema,
  entry_point: z.string().optional(),
  photo_path: z.string().optional(),
  locale: z.string().default("en"),
  profile_id: uuidSchema.optional(),
})
export type TouristCreate = z.infer<typeof touristCreateSchema>

export const touristPublicSchema = z.object({
  id: uuidSchema,
  full_name: z.string(),
  nationality: z.string(),
  kyc_type: kycTypeSchema,
  kyc_last4: z.string().nullable(),
  photo_path: z.string().nullable(),
  trip_start: timestamptzSchema,
  trip_end: timestamptzSchema,
  safety_score: z.number().int().min(0).max(100),
  last_ping_at: timestamptzSchema.nullable(),
  lat: latitudeSchema.nullable(),
  lon: longitudeSchema.nullable(),
  current_zone_ids: z.array(uuidSchema),
  tracking_enabled: z.boolean(),
  wallet_address: z.string().nullable(),
  status: touristStatusSchema,
})
export type TouristPublic = z.infer<typeof touristPublicSchema>

export const touristSchema = touristPublicSchema.extend({
  profile_id: uuidSchema.nullable(),
  date_of_birth: z.iso.date().nullable(),
  phone_e164: z.string().nullable(),
  email: z.union([z.email(), z.literal("")]).nullable(),
  emergency_contacts: z.array(emergencyContactSchema),
  entry_point: z.string().nullable(),
  hd_index: z.number().int().nullable(),
  created_at: timestamptzSchema,
  updated_at: timestamptzSchema,
})
export type Tourist = z.infer<typeof touristSchema>
