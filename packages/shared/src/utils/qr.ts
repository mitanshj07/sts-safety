import { z } from "zod"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_FIND =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

export const stsQrPayloadSchema = z.object({
  v: z.number().int().optional(),
  kind: z.string().optional(),
  chainId: z.number().int().optional(),
  contract: z.string().optional(),
  tokenId: z.union([z.string(), z.number()]).nullable().optional(),
  token_id: z.union([z.string(), z.number()]).nullable().optional(),
  t: z.union([z.string(), z.number()]).optional(),
  digitalId: z.string().optional(),
  digital_id: z.string().optional(),
  touristId: z.string().optional(),
  tourist_id: z.string().optional(),
  vcPath: z.string().nullable().optional(),
  sig: z.string().nullable().optional(),
  kycStatus: z.enum(["skipped", "pending", "verified"]).optional(),
})

export type StsQrPayload = z.infer<typeof stsQrPayloadSchema>

export type CredentialRef = {
  tokenId: string | null
  digitalId: string | null
  touristId: string | null
  raw: string
}

function asId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function queryParam(text: string, key: string): string | null {
  const match = text.match(new RegExp(`[?&]${key}=([^&#]+)`, "i"))
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function fromObject(parsed: StsQrPayload): CredentialRef {
  const digitalId = asId(parsed.digitalId) ?? asId(parsed.digital_id)
  const touristId = asId(parsed.touristId) ?? asId(parsed.tourist_id)
  const tokenRaw = asId(parsed.tokenId) ?? asId(parsed.token_id) ?? asId(parsed.t)
  let tokenId = tokenRaw
  let digitalFromToken: string | null = null
  if (tokenRaw && looksLikeUuid(tokenRaw)) {
    digitalFromToken = tokenRaw
    tokenId = null
  }
  return {
    tokenId,
    digitalId: digitalId ?? digitalFromToken,
    touristId,
    raw: "",
  }
}

/**
 * Parse a checkpoint QR / paste: JSON payload, verify URL, UUID, or numeric token.
 */
export function parseCredentialQr(raw: string): CredentialRef | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("?")) {
    const token =
      queryParam(trimmed, "token") ??
      queryParam(trimmed, "tokenId") ??
      queryParam(trimmed, "t")
    const digitalId =
      queryParam(trimmed, "digitalId") ??
      queryParam(trimmed, "id") ??
      queryParam(trimmed, "did")
    const touristId =
      queryParam(trimmed, "touristId") ?? queryParam(trimmed, "tourist")
    if (token || digitalId || touristId) {
      const tokenId = token && looksLikeUuid(token) ? null : token
      const digitalFromToken = token && looksLikeUuid(token) ? token : null
      return {
        tokenId,
        digitalId: digitalId ?? digitalFromToken,
        touristId,
        raw: trimmed,
      }
    }
  }

  if (looksLikeUuid(trimmed)) {
    return { tokenId: null, digitalId: trimmed, touristId: null, raw: trimmed }
  }

  if (/^\d+$/.test(trimmed)) {
    return { tokenId: trimmed, digitalId: null, touristId: null, raw: trimmed }
  }

  try {
    const parsed = stsQrPayloadSchema.safeParse(JSON.parse(trimmed))
    if (parsed.success) {
      return { ...fromObject(parsed.data), raw: trimmed }
    }
  } catch {
    // Not JSON — fall through to a UUID embedded in pasted text ("ID <uuid>").
  }

  const embedded = trimmed.match(UUID_FIND)
  if (embedded?.[0]) {
    return { tokenId: null, digitalId: embedded[0], touristId: null, raw: trimmed }
  }

  return null
}

export function credentialRefIsEmpty(ref: CredentialRef): boolean {
  return !ref.tokenId && !ref.digitalId && !ref.touristId
}
