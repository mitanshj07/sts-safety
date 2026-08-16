// apps/web/src/lib/chain/anchor.ts
import "server-only";

import type { Hex } from "viem";

import { ANCHOR_KIND_ONCHAIN, uuidToBytes16 } from "@sts/shared";

import { incidentAnchorAbi } from "@/lib/chain/abi/IncidentAnchor";
import {
  ChainDisabledError,
  getIssuerAccount,
  getPublicClient,
  isChainWriteEnabled,
  writeSimulated,
  type TxWaitResult,
} from "@/lib/chain/clients";
import { incidentAnchorAddress } from "@/lib/chain/config";
import { issueIdentity, nationalityToBytes2, revokeIdentity } from "@/lib/chain/registry";
import { kycTypeToUint8 } from "@/lib/identity/kyc";
import { buildAndStoreVc } from "@/lib/identity/vc-store";
import { anchorBatchSize, anchorMaxAttempts } from "@/lib/chain/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type DbAnchorKind =
  | "id_issue"
  | "id_revoke"
  | "id_extend"
  | "incident"
  | "incident_resolution"
  | "efir"
  | "zone_definition";

export type AnchorRow = {
  id: string;
  kind: DbAnchorKind;
  subject_id: string;
  record_hash: string;
  chain_id: number;
  contract_address: string | null;
  tx_hash: string | null;
  block_number: number | null;
  status: "pending" | "submitted" | "confirmed" | "failed";
  attempts: number;
  error: string | null;
};

export type IntegrityCheck = {
  matched: boolean;
  anchoredAt: bigint;
};

function onChainKind(kind: DbAnchorKind): number {
  switch (kind) {
    case "incident":
      return ANCHOR_KIND_ONCHAIN.Incident;
    case "incident_resolution":
      return ANCHOR_KIND_ONCHAIN.Resolution;
    case "efir":
      return ANCHOR_KIND_ONCHAIN.EFIR;
    case "zone_definition":
      return ANCHOR_KIND_ONCHAIN.ZoneDefinition;
    default:
      return ANCHOR_KIND_ONCHAIN.None;
  }
}

function severityToUint8(severity: string): number {
  switch (severity) {
    case "info":
      return 0;
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    case "critical":
      return 4;
    default:
      return 2;
  }
}

export async function anchorRecord(args: {
  incidentId: string;
  recordHash: Hex;
  touristToken: bigint;
  kind: DbAnchorKind;
  severity: string;
  occurredAt: bigint;
}): Promise<{ sequence: bigint } & TxWaitResult> {
  const account = getIssuerAccount();
  if (!account) {
    throw new ChainDisabledError("anchor");
  }
  const publicClient = getPublicClient();
  const { request, result } = await publicClient.simulateContract({
    account,
    address: incidentAnchorAddress(),
    abi: incidentAnchorAbi,
    functionName: "anchor",
    args: [
      uuidToBytes16(args.incidentId),
      args.recordHash,
      args.touristToken,
      onChainKind(args.kind),
      severityToUint8(args.severity),
      args.occurredAt,
    ],
  });
  const waited = await writeSimulated(request);
  return { sequence: result, ...waited };
}

export async function verifyIntegrity(
  incidentId: string,
  recordHash: Hex,
): Promise<IntegrityCheck> {
  const publicClient = getPublicClient();
  const [matched, anchoredAt] = await publicClient.readContract({
    address: incidentAnchorAddress(),
    abi: incidentAnchorAbi,
    functionName: "verifyIntegrity",
    args: [uuidToBytes16(incidentId), recordHash],
  });
  return { matched, anchoredAt };
}

type IncidentAnchorPayload = {
  incidentId: string;
  recordHash: Hex;
  touristToken: bigint;
  kind: number;
  severity: number;
  occurredAt: bigint;
  rowId: string;
};

async function loadIncidentPayload(
  row: AnchorRow,
): Promise<IncidentAnchorPayload | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("incidents")
    .select("id, severity, occurred_at, tourist_id")
    .eq("id", row.subject_id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  let touristToken = BigInt(0);
  if (typeof data.tourist_id === "string") {
    const { data: did } = await admin
      .from("digital_ids")
      .select("token_id")
      .eq("tourist_id", data.tourist_id)
      .eq("status", "active")
      .maybeSingle();
    if (did?.token_id !== null && did?.token_id !== undefined) {
      touristToken = BigInt(String(did.token_id));
    }
  }
  const occurredAt = BigInt(
    Math.floor(new Date(String(data.occurred_at)).getTime() / 1000),
  );
  return {
    incidentId: String(data.id),
    recordHash: row.record_hash as Hex,
    touristToken,
    kind: onChainKind(row.kind),
    severity: severityToUint8(String(data.severity ?? "medium")),
    occurredAt,
    rowId: row.id,
  };
}

async function markAnchor(
  id: string,
  patch: Record<string, string | number | null>,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("chain_anchors").update(patch).eq("id", id);
}

async function retryIdIssue(row: AnchorRow): Promise<boolean> {
  const admin = createAdminClient();
  const { data: did, error } = await admin
    .from("digital_ids")
    .select(
      "id, tourist_id, holder_address, kyc_commitment, itinerary_hash, metadata_uri, valid_from, valid_until, token_id, issue_tx_hash, vc_path",
    )
    .eq("id", row.subject_id)
    .maybeSingle();
  if (error || !did) {
    await markAnchor(row.id, {
      status: "failed",
      error: "digital_ids row missing",
      attempts: row.attempts + 1,
    });
    return false;
  }
  if (did.token_id !== null && did.issue_tx_hash) {
    await markAnchor(row.id, {
      status: "confirmed",
      tx_hash: String(did.issue_tx_hash),
      error: null,
      attempts: row.attempts + 1,
      confirmed_at: new Date().toISOString(),
    });
    return true;
  }

  const { data: tourist } = await admin
    .from("tourists")
    .select("kyc_type, nationality")
    .eq("id", did.tourist_id)
    .maybeSingle();
  if (!tourist) {
    await markAnchor(row.id, {
      status: "failed",
      error: "tourist row missing",
      attempts: row.attempts + 1,
    });
    return false;
  }

  const issued = await issueIdentity({
    to: did.holder_address as `0x${string}`,
    kycCommitment: did.kyc_commitment as Hex,
    itineraryHash: (did.itinerary_hash ??
      "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex,
    validFrom: BigInt(Math.floor(new Date(String(did.valid_from)).getTime() / 1000)),
    validUntil: BigInt(Math.floor(new Date(String(did.valid_until)).getTime() / 1000)),
    kycType: kycTypeToUint8(String(tourist.kyc_type)),
    nationality: nationalityToBytes2(String(tourist.nationality ?? "IN")),
    metadataURI: String(did.metadata_uri ?? ""),
  });

  await admin
    .from("digital_ids")
    .update({
      token_id: issued.tokenId.toString(),
      issue_tx_hash: issued.txHash,
      issue_block: Number(issued.blockNumber),
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", did.id);

  if (!did.vc_path) {
    await buildAndStoreVc({
      digitalId: String(did.id),
      tokenId: issued.tokenId,
      holder: did.holder_address as `0x${string}`,
      kycCommitment: did.kyc_commitment as Hex,
      itineraryHash: (did.itinerary_hash ??
        "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex,
      validFrom: BigInt(Math.floor(new Date(String(did.valid_from)).getTime() / 1000)),
      validUntil: BigInt(Math.floor(new Date(String(did.valid_until)).getTime() / 1000)),
      kycType: kycTypeToUint8(String(tourist.kyc_type)),
      nationality: String(tourist.nationality ?? "IN"),
    });
  }

  await markAnchor(row.id, {
    status: "confirmed",
    tx_hash: issued.txHash,
    block_number: Number(issued.blockNumber),
    error: null,
    attempts: row.attempts + 1,
    confirmed_at: new Date().toISOString(),
  });
  return true;
}

async function retryIdRevoke(row: AnchorRow): Promise<boolean> {
  const admin = createAdminClient();
  const { data: did } = await admin
    .from("digital_ids")
    .select("token_id, revocation_reason")
    .eq("id", row.subject_id)
    .maybeSingle();
  if (!did?.token_id) {
    await markAnchor(row.id, {
      status: "failed",
      error: "token_id missing",
      attempts: row.attempts + 1,
    });
    return false;
  }
  const waited = await revokeIdentity(
    BigInt(String(did.token_id)),
    String(did.revocation_reason ?? "REVOKED"),
  );
  await admin
    .from("digital_ids")
    .update({
      status: "revoked",
      revoke_tx_hash: waited.txHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.subject_id);
  await markAnchor(row.id, {
    status: "confirmed",
    tx_hash: waited.txHash,
    block_number: Number(waited.blockNumber),
    error: null,
    attempts: row.attempts + 1,
    confirmed_at: new Date().toISOString(),
  });
  return true;
}

async function drainIncidentBatch(rows: AnchorRow[]): Promise<number> {
  const account = getIssuerAccount();
  if (!account) {
    throw new ChainDisabledError("anchorBatch");
  }
  const payloads: IncidentAnchorPayload[] = [];
  for (const row of rows) {
    const payload = await loadIncidentPayload(row);
    if (payload) {
      payloads.push(payload);
    } else {
      await markAnchor(row.id, {
        status: "failed",
        error: "incident missing",
        attempts: row.attempts + 1,
      });
    }
  }
  if (payloads.length === 0) {
    return 0;
  }
  const publicClient = getPublicClient();
  const { request } = await publicClient.simulateContract({
    account,
    address: incidentAnchorAddress(),
    abi: incidentAnchorAbi,
    functionName: "anchorBatch",
    args: [
      payloads.map((p) => uuidToBytes16(p.incidentId)),
      payloads.map((p) => p.recordHash),
      payloads.map((p) => p.touristToken),
      payloads.map((p) => p.kind),
      payloads.map((p) => p.severity),
      payloads.map((p) => p.occurredAt),
    ],
  });
  const waited = await writeSimulated(request);
  for (const payload of payloads) {
    await markAnchor(payload.rowId, {
      status: "confirmed",
      tx_hash: waited.txHash,
      block_number: Number(waited.blockNumber),
      error: null,
      confirmed_at: new Date().toISOString(),
    });
  }
  return payloads.length;
}

export type DrainResult = {
  processed: number;
  confirmed: number;
  failed: number;
  skipped: boolean;
};

export async function drainPendingAnchors(): Promise<DrainResult> {
  if (!isChainWriteEnabled()) {
    return { processed: 0, confirmed: 0, failed: 0, skipped: true };
  }
  const admin = createAdminClient();
  const maxAttempts = anchorMaxAttempts();
  const limit = anchorBatchSize();
  const { data, error } = await admin
    .from("chain_anchors")
    .select(
      "id, kind, subject_id, record_hash, chain_id, contract_address, tx_hash, block_number, status, attempts, error",
    )
    .in("status", ["pending", "failed"])
    .lt("attempts", maxAttempts)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as AnchorRow[];
  let confirmed = 0;
  let failed = 0;
  const incidentRows: AnchorRow[] = [];

  for (const row of rows) {
    await markAnchor(row.id, { attempts: row.attempts + 1 });
    try {
      if (row.kind === "id_issue") {
        const ok = await retryIdIssue({ ...row, attempts: row.attempts + 1 });
        if (ok) confirmed += 1;
        else failed += 1;
      } else if (row.kind === "id_revoke") {
        const ok = await retryIdRevoke({ ...row, attempts: row.attempts + 1 });
        if (ok) confirmed += 1;
        else failed += 1;
      } else {
        incidentRows.push(row);
      }
    } catch (cause) {
      failed += 1;
      await markAnchor(row.id, {
        status: "failed",
        error: cause instanceof Error ? cause.message : "chain write failed",
      });
    }
  }

  if (incidentRows.length > 0) {
    try {
      const n = await drainIncidentBatch(incidentRows);
      confirmed += n;
    } catch (cause) {
      failed += incidentRows.length;
      for (const row of incidentRows) {
        await markAnchor(row.id, {
          status: "failed",
          error: cause instanceof Error ? cause.message : "anchorBatch failed",
        });
      }
    }
  }

  return {
    processed: rows.length,
    confirmed,
    failed,
    skipped: false,
  };
}
