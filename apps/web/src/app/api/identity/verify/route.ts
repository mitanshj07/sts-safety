// apps/web/src/app/api/identity/verify/route.ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { idStatusSchema } from "@sts/shared"
import { COMMAND_ROLES } from "@/lib/auth/roles"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { verifyIdentity } from "@/lib/chain/registry"
import { explorerTokenUrl } from "@/lib/chain/config"
import { signedPhotoUrl } from "@/lib/command/queries"
import { createAdminClient } from "@/lib/supabase/admin"
import { asRecord } from "@/lib/geo/parse"

export const runtime = "nodejs"

const bodySchema = z.object({
  tokenId: z.union([z.string(), z.number()]).optional(),
  touristId: z.string().uuid().optional(),
  vcPath: z.string().trim().min(1).max(500).optional(),
})

type EmergencyContact = {
  name: string
  relation: string
  phone_e164: string
}

function parseTokenId(value: string | number | undefined): bigint | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw || raw === "null" || raw === "undefined") return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

function asIdStatus(value: unknown) {
  const parsed = idStatusSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function contactsOf(value: unknown): EmergencyContact[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = asRecord(item)
    if (typeof row.name !== "string" || typeof row.phone_e164 !== "string") return []
    return [
      {
        name: row.name,
        relation: typeof row.relation === "string" ? row.relation : "contact",
        phone_e164: row.phone_e164,
      },
    ]
  })
}

function emptyOnChain(token: bigint | null, error?: string) {
  return {
    valid: false,
    status: 0,
    validUntil: 0,
    commitment: "0x",
    explorerUrl: token != null ? explorerTokenUrl(token) : null,
    source: "offline" as const,
    error,
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(request, COMMAND_ROLES)
  } catch (error) {
    return jsonAuthError(error)
  }

  const json: unknown = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "tokenId, touristId, or vcPath required" }, { status: 400 })
  }

  let token = parseTokenId(parsed.data.tokenId)
  if (parsed.data.tokenId != null && token == null) {
    return NextResponse.json({ error: "tokenId must be an integer" }, { status: 400 })
  }
  if (token == null && !parsed.data.touristId && !parsed.data.vcPath) {
    return NextResponse.json({ error: "tokenId, touristId, or vcPath required" }, { status: 400 })
  }

  let mirror: Record<string, unknown> | null = null
  let touristId = parsed.data.touristId ?? null

  try {
    const admin = createAdminClient()
    let digitalQuery = admin
      .from("digital_ids")
      .select(
        "tourist_id, status, chain_id, contract_address, kyc_commitment, valid_from, valid_until, holder_address, issue_tx_hash, issue_block, token_id, vc_path",
      )

    if (token != null) {
      digitalQuery = digitalQuery.eq("token_id", token.toString())
    } else if (parsed.data.touristId) {
      digitalQuery = digitalQuery
        .eq("tourist_id", parsed.data.touristId)
        .order("created_at", { ascending: false })
        .limit(1)
    } else if (parsed.data.vcPath) {
      digitalQuery = digitalQuery.eq("vc_path", parsed.data.vcPath)
    }

    const { data } = await digitalQuery.maybeSingle()
    if (data) {
      const rec = asRecord(data)
      touristId = typeof rec.tourist_id === "string" ? rec.tourist_id : touristId
      if (token == null && rec.token_id != null) {
        token = parseTokenId(String(rec.token_id))
      }
      const { data: touristRow } = touristId
        ? await admin
            .from("tourists")
            .select(
              "id, full_name, nationality, photo_path, phone_e164, safety_score, kyc_type, kyc_last4, trip_start, trip_end, emergency_contacts",
            )
            .eq("id", touristId)
            .maybeSingle()
        : { data: null }
      mirror = { ...rec, tourist: touristRow ?? null }
    } else if (touristId) {
      const { data: touristRow } = await admin
        .from("tourists")
        .select(
          "id, full_name, nationality, photo_path, phone_e164, safety_score, kyc_type, kyc_last4, trip_start, trip_end, emergency_contacts",
        )
        .eq("id", touristId)
        .maybeSingle()
      if (touristRow) {
        mirror = { tourist: touristRow }
      }
    }
  } catch {
    mirror = null
  }

  let onChain: {
    valid: boolean
    status: number
    validUntil: number
    commitment: string
    explorerUrl: string | null
    source: "chain" | "offline"
    error?: string
  }
  if (token == null) {
    onChain = emptyOnChain(null, "Token is not on-chain yet")
  } else {
    try {
      const result = await verifyIdentity(token)
      onChain = {
        valid: result.valid,
        status: Number(result.status),
        validUntil: Number(result.validUntil),
        commitment: result.commitment,
        explorerUrl: explorerTokenUrl(token),
        source: "chain",
      }
    } catch (error) {
      onChain = emptyOnChain(
        token,
        error instanceof Error ? error.message : "RPC error",
      )
    }
  }

  const touristRow =
    mirror && typeof mirror.tourist === "object" && mirror.tourist
      ? asRecord(mirror.tourist)
      : null
  const photoUrl = touristRow ? await signedPhotoUrl(asString(touristRow.photo_path)) : null

  const tourist = touristRow
    ? {
        id: String(touristRow.id ?? touristId ?? ""),
        full_name: String(touristRow.full_name ?? "Unknown tourist"),
        nationality: String(touristRow.nationality ?? "—"),
        photoUrl,
        phone_e164: asString(touristRow.phone_e164),
        safety_score: Number(touristRow.safety_score ?? 100),
        kyc_type: asString(touristRow.kyc_type),
        kyc_last4: asString(touristRow.kyc_last4),
        trip_start: asString(touristRow.trip_start),
        trip_end: asString(touristRow.trip_end),
        emergency_contacts: contactsOf(touristRow.emergency_contacts),
      }
    : null

  const digitalId = mirror
    ? {
        token_id: asString(mirror.token_id) ?? (token != null ? token.toString() : null),
        status: asIdStatus(mirror.status),
        valid_from: asString(mirror.valid_from),
        valid_until: asString(mirror.valid_until),
        issue_tx_hash: asString(mirror.issue_tx_hash),
      }
    : token != null
      ? {
          token_id: token.toString(),
          status: onChain.valid ? ("active" as const) : null,
          valid_from: null,
          valid_until: onChain.validUntil
            ? new Date(onChain.validUntil * 1000).toISOString()
            : null,
          issue_tx_hash: null,
        }
      : null

  return NextResponse.json({
    tokenId: token != null ? token.toString() : null,
    onChain,
    tourist,
    digitalId,
    mirror,
  })
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}
