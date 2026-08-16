// apps/web/src/lib/tourist/schemas.ts
import { z } from "zod";

export const kycTypeSchema = z.enum([
  "passport",
  "aadhaar",
  "voter_id",
  "driving_licence",
]);

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relation: z.string().trim().min(1).max(60),
  phone_e164: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use E.164, e.g. +9198…"),
  email: z.email().optional(),
  notify: z.boolean(),
});

export const issueIdentityRequestSchema = z
  .object({
    kyc_type: kycTypeSchema,
    kyc_number: z.string().trim().min(4).max(32),
    full_name: z.string().trim().min(2).max(120),
    nationality: z
      .string()
      .trim()
      .length(2)
      .transform((v) => v.toUpperCase()),
    date_of_birth: z.iso.date(),
    phone_e164: z
      .string()
      .regex(/^\+[1-9]\d{7,14}$/)
      .optional(),
    email: z.email().optional(),
    emergency_contacts: z.array(emergencyContactSchema).min(1).max(3),
    trip_start: z.iso.datetime(),
    trip_end: z.iso.datetime(),
    itinerary_id: z.string().min(1),
    entry_point: z.string().trim().max(120).optional(),
    photo_data_url: z.string().max(2_000_000).optional(),
  })
  .refine((v) => Date.parse(v.trip_end) > Date.parse(v.trip_start), {
    message: "Trip end must be after trip start",
    path: ["trip_end"],
  });

export type IssueIdentityRequest = z.infer<typeof issueIdentityRequestSchema>;
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;
export type KycType = z.infer<typeof kycTypeSchema>;

export const issueIdentityResponseSchema = z.object({
  ok: z.boolean(),
  tourist_id: z.string().optional(),
  token_id: z.string().nullable(),
  tx_hash: z.string().nullable(),
  explorer_url: z.string().nullable(),
  vc_path: z.string().nullable(),
  chain_id: z.number(),
  contract: z.string(),
  status: z.enum(["pending", "active"]),
  steps: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      status: z.enum(["done", "running", "pending", "failed"]),
      detail: z.string().optional(),
    }),
  ),
  error: z.string().optional(),
});

export type IssueIdentityResponse = z.infer<typeof issueIdentityResponseSchema>;

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  user_agent: z.string().max(400).optional(),
});

export type PushSubscribeRequest = z.infer<typeof pushSubscribeSchema>;

export const qrPayloadSchema = z.object({
  chainId: z.number(),
  contract: z.string(),
  tokenId: z.string().nullable(),
  vcPath: z.string().nullable(),
});

export type QrPayload = z.infer<typeof qrPayloadSchema>;

export const geoFixSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  accuracy_m: z.number().nullable(),
  altitude_m: z.number().nullable(),
  speed_mps: z.number().nullable(),
  heading_deg: z.number().nullable(),
  battery_pct: z.number().int().min(0).max(100).nullable(),
  recorded_at: z.string(),
});

export type GeoFix = z.infer<typeof geoFixSchema>;
