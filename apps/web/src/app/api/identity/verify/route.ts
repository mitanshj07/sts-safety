// apps/web/src/app/api/identity/verify/route.ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { COMMAND_ROLES } from "@/lib/auth/roles"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { verifyIdentity } from "@/lib/chain/registry"
import { explorerTokenUrl } from "@/lib/chain/config"
import { createAdminClient } from "@/lib/supabase/admin"
import { asRecord } from "@/lib/geo/parse"

export const runtime = "nodejs"

const bodySchema = z.object({
  tokenId: z.union([z.string(), z.number()]),
})

export async function POST(request: Request) {
  try {
    await requireRole(request, COMMAND_ROLES)
  } catch (error) {
    return jsonAuthError(error)
  }

  const json: unknown = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 })
  }

  let token: bigint
  try {
    token = BigInt(parsed.data.tokenId)
  } catch {
    return NextResponse.json({ error: "tokenId must be an integer" }, { status: 400 })
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

  let mirror: Record<string, unknown> | null = null
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from("digital_ids")
      .select(
        "tourist_id, status, chain_id, contract_address, kyc_commitment, valid_from, valid_until, holder_address, issue_tx_hash, issue_block, token_id",
      )
      .eq("token_id", token.toString())
      .maybeSingle()
    if (data) {
      const rec = asRecord(data)
      const { data: tourist } = await admin
        .from("tourists")
        .select("full_name, nationality, photo_path")
        .eq("id", rec.tourist_id)
        .maybeSingle()
      mirror = { ...rec, tourist: tourist ?? null }
    }
  } catch {
    mirror = null
  }

  return NextResponse.json({
    tokenId: token.toString(),
    onChain,
    mirror,
  })
}
