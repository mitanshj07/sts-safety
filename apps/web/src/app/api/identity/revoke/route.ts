// apps/web/src/app/api/identity/revoke/route.ts
import { revokeIdentityRequestSchema } from "@sts/shared";

import { jsonAuthError, requireRole } from "@/lib/auth/guards";
import { ChainDisabledError } from "@/lib/chain/clients";
import { explorerTxUrl, registryAddress } from "@/lib/chain/config";
import { revokeIdentity } from "@/lib/chain/registry";
import { publicChainId } from "@/lib/chain/env";
import { identityLog } from "@/lib/identity/log";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireRole(request, ["admin"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
    }

    const parsed = revokeIdentityRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: "validation_failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: did, error } = await admin
      .from("digital_ids")
      .select("id, tourist_id, token_id, status, kyc_commitment")
      .eq("token_id", parsed.data.tokenId.toString())
      .eq("contract_address", registryAddress())
      .maybeSingle();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!did) {
      return Response.json({ ok: false, error: "digital id not found" }, { status: 404 });
    }

    const beforeStatus = String(did.status);
    let txHash: string | null = null;
    let chainPending = false;

    try {
      const waited = await revokeIdentity(parsed.data.tokenId, parsed.data.reason);
      txHash = waited.txHash;
      await admin
        .from("digital_ids")
        .update({
          status: "revoked",
          revocation_reason: parsed.data.reason,
          revoke_tx_hash: waited.txHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", did.id);
      await admin.from("chain_anchors").insert({
        kind: "id_revoke",
        subject_id: did.id,
        record_hash: String(did.kyc_commitment),
        chain_id: publicChainId(),
        contract_address: registryAddress(),
        tx_hash: waited.txHash,
        block_number: Number(waited.blockNumber),
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      });
    } catch (cause) {
      chainPending = true;
      await admin
        .from("digital_ids")
        .update({
          status: "revoked",
          revocation_reason: parsed.data.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", did.id);
      await admin.from("chain_anchors").insert({
        kind: "id_revoke",
        subject_id: did.id,
        record_hash: String(did.kyc_commitment),
        chain_id: publicChainId(),
        contract_address: registryAddress(),
        status: cause instanceof ChainDisabledError ? "pending" : "failed",
        error: cause instanceof Error ? cause.message : "revoke failed",
      });
    }

    await admin.from("audit_log").insert({
      actor_id: actor.id,
      actor_role: actor.role,
      action: "identity.revoke",
      entity: "digital_ids",
      entity_id: String(did.id),
      before: { status: beforeStatus, token_id: String(did.token_id) },
      after: {
        status: "revoked",
        reason: parsed.data.reason,
        txHash,
        chainPending,
      },
    });

    identityLog("revoke_http", {
      digitalId: String(did.id),
      tokenId: parsed.data.tokenId.toString(),
      chainPending,
    });

    return Response.json({
      ok: true,
      tokenId: parsed.data.tokenId.toString(),
      status: "revoked",
      txHash,
      explorerUrl: explorerTxUrl(txHash as `0x${string}` | null),
      chainPending,
    });
  } catch (cause) {
    return jsonAuthError(cause);
  }
}
