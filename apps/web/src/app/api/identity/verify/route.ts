// apps/web/src/app/api/identity/verify/route.ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { parseCredentialQr } from "@sts/shared"
import { COMMAND_ROLES } from "@/lib/auth/roles"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { verifyIdentity } from "@/lib/chain/registry"
import { explorerTokenUrl } from "@/lib/chain/config"
import { createAdminClient } from "@/lib/supabase/admin"
import { asRecord } from "@/lib/geo/parse"

export const runtime = "nodejs"

const bodySchema = z.object({
  tokenId: z.union([z.string(), z.number()]).optional(),
  digitalId: z.string().optional(),
  touristId: z.string().optional(),
  qr: z.string().optional(),
})

function tokenAsBigInt(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null
  try {
    return BigInt(value)
  } catch {
    return null
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
    return NextResponse.json({ error: "credential required" }, { status: 400 })
  }

  const fromQr = parsed.data.qr ? parseCredentialQr(parsed.data.qr) : null
  const tokenRaw =
    parsed.data.tokenId != null ? String(parsed.data.tokenId) : fromQr?.tokenId
  const digitalId = parsed.data.digitalId ?? fromQr?.digitalId ?? null
  const touristId = parsed.data.touristId ?? fromQr?.touristId ?? null

  if (!tokenRaw && !digitalId && !touristId) {
    return NextResponse.json({ error: "tokenId, digitalId, or touristId required" }, { status: 400 })
  }

  const token = tokenRaw ? tokenAsBigInt(tokenRaw) : null

  let onChain: {
    valid: boolean
    status: number
    validUntil: number
    commitment: string
    explorerUrl: string | null
    source: "chain" | "offline" | "mirror"
    error?: string
  } | null = null

  if (token !== null) {
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
      onChain = {
        valid: false,
        status: 0,
        validUntil: 0,
        commitment: "0x",
        explorerUrl: explorerTokenUrl(token),
        source: "offline",
        error: error instanceof Error ? error.message : "RPC error",
      }
    }
  }

  let mirror: Record<string, unknown> | null = null
  try {
    const admin = createAdminClient()
    const selectCols =
      "id, tourist_id, status, chain_id, contract_address, kyc_commitment, valid_from, valid_until, holder_address, issue_tx_hash, issue_block, token_id"

    async function lookupRow() {
      if (digitalId) {
        const byId = await admin
          .from("digital_ids")
          .select(selectCols)
          .eq("id", digitalId)
          .maybeSingle()
        if (byId.data) return byId.data
        const byTourist = await admin
          .from("digital_ids")
          .select(selectCols)
          .eq("tourist_id", digitalId)
          .in("status", ["pending", "active"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (byTourist.data) return byTourist.data
      }
      if (tokenRaw && /^\d+$/.test(tokenRaw)) {
        const byToken = await admin
          .from("digital_ids")
          .select(selectCols)
          .eq("token_id", tokenRaw)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (byToken.data) return byToken.data
      }
      if (touristId) {
        const byTourist = await admin
          .from("digital_ids")
          .select(selectCols)
          .eq("tourist_id", touristId)
          .in("status", ["pending", "active"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (byTourist.data) return byTourist.data
      }
      return null
    }

    const data = await lookupRow()
    if (data) {
      const rec = asRecord(data)
      const { data: tourist } = await admin
        .from("tourists")
        .select("full_name, nationality, photo_path, kyc_last4, kyc_type, kyc_status")
        .eq("id", rec.tourist_id)
        .maybeSingle()
      const { data: itinerary } = await admin
        .from("itineraries")
        .select("id, title, corridor_m, waypoints, starts_at, ends_at")
        .eq("tourist_id", rec.tourist_id)
        .eq("active", true)
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      mirror = { ...rec, tourist: tourist ?? null, itinerary: itinerary ?? null }
    }
  } catch {
    mirror = null
  }

  if (!onChain && mirror) {
    const status = String(mirror.status ?? "pending")
    const until = typeof mirror.valid_until === "string" ? Date.parse(mirror.valid_until) / 1000 : 0
    const now = Date.now() / 1000
    const kycStatus = asRecord(mirror.tourist ?? {}).kyc_status
    const valid =
      (status === "active" || status === "pending") &&
      (until === 0 || until >= now)
    onChain = {
      valid,
      status: status === "active" ? 1 : status === "pending" ? 2 : 0,
      validUntil: Number.isFinite(until) ? until : 0,
      commitment: String(mirror.kyc_commitment ?? "0x"),
      explorerUrl: token ? explorerTokenUrl(token) : null,
      source: "mirror",
      error: kycStatus === "skipped" ? "guest_credential" : undefined,
    }
  }

  if (!onChain) {
    onChain = {
      valid: false,
      status: 0,
      validUntil: 0,
      commitment: "0x",
      explorerUrl: token ? explorerTokenUrl(token) : null,
      source: "offline",
      error: "not_found",
    }
  }

  return NextResponse.json({
    tokenId: token !== null ? token.toString() : String(mirror?.token_id ?? digitalId ?? touristId ?? ""),
    digitalId: mirror && typeof mirror.id === "string" ? mirror.id : digitalId,
    onChain,
    mirror,
  })
}
