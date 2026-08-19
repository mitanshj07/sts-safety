// packages/shared/src/schemas/identity.ts
import { z } from "zod"
import { kycIssuanceIssues } from "../utils/kyc"
import { lonLatTupleSchema, timestamptzSchema } from "./coords"
import { kycStatusSchema, kycTypeSchema } from "./enums"
import { waypointSchema } from "./itinerary"
import { emergencyContactSchema } from "./tourist"

export const geojsonPositionSchema = lonLatTupleSchema

export const geojsonLineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(geojsonPositionSchema).min(2),
})

export const issueIdentityRequestSchema = z
  .object({
    skipKyc: z.boolean().optional().default(false),
    kycType: kycTypeSchema.optional(),
    kycNumber: z.string().min(4).max(32).optional(),
    name: z.string().min(1).max(120).optional(),
    nationality: z
      .string()
      .length(2)
      .overwrite((v) => v.toUpperCase())
      .optional(),
    dateOfBirth: z.iso.date().optional(),
    phone: z.string().min(5).max(20).optional(),
    email: z.email().optional(),
    emergencyContacts: z.array(emergencyContactSchema).optional(),
    tripStart: timestamptzSchema,
    tripEnd: timestamptzSchema,
    entryPoint: z.string().max(120).optional(),
    itineraryGeoJSON: geojsonLineStringSchema.optional(),
    itineraryTitle: z.string().max(160).optional(),
    itineraryPresetId: z.string().max(64).optional(),
    itineraryWaypoints: z.array(waypointSchema).optional(),
    corridorM: z.number().int().positive().max(50_000).optional(),
    locale: z.string().max(8).optional(),
    profileId: z.uuid().optional(),
  })
  .superRefine((d, ctx) => {
    if (Date.parse(d.tripEnd) <= Date.parse(d.tripStart)) {
      ctx.addIssue({
        code: "custom",
        message: "tripEnd must be after tripStart",
        path: ["tripEnd"],
      })
    }
    if (d.skipKyc) {
      return
    }
    if (!d.name || d.name.trim().length < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the traveller's full name.",
        path: ["name"],
      })
    }
    if (!d.nationality) {
      ctx.addIssue({
        code: "custom",
        message: "Nationality must be an ISO 3166-1 alpha-2 code.",
        path: ["nationality"],
      })
      return
    }
    if (!d.kycType || !d.kycNumber) {
      ctx.addIssue({
        code: "custom",
        message: "Travel document type and number are required.",
        path: ["kycNumber"],
      })
      return
    }
    for (const issue of kycIssuanceIssues({
      nationality: d.nationality,
      kycType: d.kycType,
      kycNumber: d.kycNumber,
    })) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: [issue.path],
      })
    }
  })
export type IssueIdentityRequest = z.infer<typeof issueIdentityRequestSchema>

export const saveItineraryRequestSchema = z.object({
  itineraryPresetId: z.string().min(1).max(64).optional(),
  itineraryTitle: z.string().max(160).optional(),
  itineraryGeoJSON: geojsonLineStringSchema.optional(),
  itineraryWaypoints: z.array(waypointSchema).optional(),
  corridorM: z.number().int().positive().max(50_000).optional(),
  tripStart: timestamptzSchema.optional(),
  tripEnd: timestamptzSchema.optional(),
  entryPoint: z.string().max(120).optional(),
})
export type SaveItineraryRequest = z.infer<typeof saveItineraryRequestSchema>

export const identityReasonCodeSchema = z.enum([
  "VALID",
  "NOT_FOUND",
  "REVOKED",
  "SUSPENDED",
  "EXPIRED",
  "NOT_YET_VALID",
  "ON_CHAIN_INVALID",
  "VC_MISSING",
  "VC_SIG_INVALID",
  "CHAIN_UNAVAILABLE",
  "CHAIN_DISABLED",
  "GUEST",
])
export type VerifyReasonCode = z.infer<typeof identityReasonCodeSchema>

export const verifyIdentityResponseSchema = z.object({
  valid: z.boolean(),
  tokenId: z.string(),
  status: z.enum([
    "none",
    "active",
    "revoked",
    "suspended",
    "expired",
    "not_found",
    "chain_unavailable",
    "pending",
  ]),
  reasons: z.array(identityReasonCodeSchema),
  validUntil: z.number().nullable(),
  commitment: z.string().nullable(),
  vcVerified: z.boolean(),
  explorerUrl: z.string().nullable(),
  holder: z.string().nullable(),
})
export type VerifyIdentityResponse = z.infer<typeof verifyIdentityResponseSchema>

export const verifyKycRequestSchema = z.object({
  tokenId: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
  kycType: kycTypeSchema,
  kycNumber: z.string().min(4).max(32),
  salt: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
})
export type VerifyKycRequest = z.infer<typeof verifyKycRequestSchema>

export const revokeIdentityRequestSchema = z.object({
  tokenId: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
  reason: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_]+$/)
    .default("REVOKED"),
})
export type RevokeIdentityRequest = z.infer<typeof revokeIdentityRequestSchema>

export const qrPayloadSchema = z.object({
  v: z.literal(1).default(1),
  kind: z.literal("sts-id").default("sts-id"),
  chainId: z.number().int(),
  contract: z.string(),
  tokenId: z.string().nullable(),
  digitalId: z.string(),
  touristId: z.string(),
  vcPath: z.string().nullable(),
  sig: z.string().nullable(),
  kycStatus: kycStatusSchema.optional(),
})
export type QrPayload = z.infer<typeof qrPayloadSchema>

export const verifiableCredentialSchema = z.object({
  "@context": z.array(z.string()).min(1),
  type: z.array(z.string()).min(1),
  issuer: z.union([
    z.string(),
    z.object({ id: z.string(), name: z.string().optional() }),
  ]),
  issuanceDate: z.string().optional(),
  validFrom: timestamptzSchema.optional(),
  validUntil: timestamptzSchema.optional(),
  credentialSubject: z.object({
    id: z.string(),
    tokenId: z.union([z.string(), z.number()]),
    holder: z.string().optional(),
    kycCommitment: z.string(),
    itineraryHash: z.string().optional(),
    kycType: z.number().int().optional(),
    nationality: z.string().optional(),
    validFrom: z.number().int().optional(),
    validUntil: z.number().int().optional(),
    chainId: z.number().int().optional(),
    contractAddress: z.string().optional(),
  }),
  proof: z.object({
    type: z.string(),
    created: z.string(),
    proofPurpose: z.string().default("assertionMethod"),
    verificationMethod: z.string(),
    proofValue: z.string(),
    eip712: z
      .object({
        domain: z.record(z.string(), z.unknown()),
        types: z.record(z.string(), z.unknown()),
        primaryType: z.string(),
        message: z.record(z.string(), z.unknown()),
      })
      .optional(),
  }),
})
export type VerifiableCredential = z.infer<typeof verifiableCredentialSchema>
