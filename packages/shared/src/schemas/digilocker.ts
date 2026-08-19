// packages/shared/src/schemas/digilocker.ts
import { z } from "zod"
import { kycTypeSchema } from "./enums"

export const digilockerFetchedDocumentSchema = z.object({
  kycType: kycTypeSchema,
  label: z.string().min(1).max(120),
  issuer: z.string().max(160),
  doctype: z.string().max(16),
})
export type DigilockerFetchedDocument = z.infer<typeof digilockerFetchedDocumentSchema>

export const digilockerSessionSchema = z.object({
  ok: z.literal(true),
  source: z.literal("digilocker"),
  mode: z.enum(["demo", "live"]),
  name: z.string().min(1).max(120),
  dateOfBirth: z.iso.date().nullable(),
  kycType: kycTypeSchema,
  kycNumber: z.string().min(4).max(32),
  kycLast4: z.string().min(2).max(8),
  documents: z.array(digilockerFetchedDocumentSchema),
  digilockerId: z.string().max(64).optional(),
})
export type DigilockerSession = z.infer<typeof digilockerSessionSchema>
