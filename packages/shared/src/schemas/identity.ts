// packages/shared/src/schemas/identity.ts
import { z } from "zod"
import { lonLatTupleSchema, timestamptzSchema } from "./coords"
import { kycTypeSchema } from "./enums"
import { emergencyContactSchema } from "./tourist"

export const geojsonPositionSchema = lonLatTupleSchema

export const geojsonLineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(geojsonPositionSchema).min(2),
})

export const issueIdentityRequestSchema = z
  .object({
    kycType: kycTypeSchema,
    kycNumber: z.string().min(4).max(32),
    name: z.string().min(1).max(120),
    nationality: z.string().length(2).overwrite((v) => v.toUpperCase()),
    dateOfBirth: z.iso.date().optional(),
    phone: z.string().min(5).max(20).optional(),
    email: z.email().optional(),
    emergencyContacts: z.array(emergencyContactSchema).optional(),
    tripStart: timestamptzSchema,
    tripEnd: timestamptzSchema,
    entryPoint: z.string().max(120).optional(),
    itineraryGeoJSON: geojsonLineStringSchema.optional(),
    itineraryTitle: z.string().max(160).optional(),
    corridorM: z.number().int().positive().max(50_000).optional(),
    locale: z.string().max(8).optional(),
    profileId: z.uuid().optional(),
  })
  .refine((d) => Date.parse(d.tripEnd) > Date.parse(d.tripStart), {
    message: "tripEnd must be after tripStart",
    path: ["tripEnd"],
  })
export type IssueIdentityRequest = z.infer<typeof issueIdentityRequestSchema>

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
  chainId: z.number().int(),
  contract: z.string(),
  tokenId: z.string(),
  vcPath: z.string().nullable(),
  sig: z.string().nullable(),
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
