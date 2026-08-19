// apps/web/src/lib/identity/issuance.ts
import "server-only";

import { randomBytes } from "node:crypto";

import { bytesToHex, type Address, type Hex } from "viem";

import {
  itineraryHash,
  kycCommitment,
  normaliseKycNumber,
  toUnixSeconds,
  type IssueIdentityRequest,
  type KycStatus,
  type QrPayload,
  type SaveItineraryRequest,
} from "@sts/shared";

import { ChainDisabledError } from "@/lib/chain/clients";
import {
  activeChainId,
  explorerTxUrl,
  registryAddress,
} from "@/lib/chain/config";
import { allocateTouristWallet, deriveTouristAddress } from "@/lib/chain/hd";
import { issueIdentity, nationalityToBytes2 } from "@/lib/chain/registry";
import {
  isZeroHex,
  piiEncryptionKey,
  publicChainId,
  storageBuckets,
} from "@/lib/chain/env";
import { kycLast4, kycTypeToUint8 } from "@/lib/identity/kyc";
import { identityLog } from "@/lib/identity/log";
import { resolveIssuePlan, resolveItinerary } from "@/lib/identity/plan";
import { buildAndStoreVc, vcObjectPath, vcPublicUrl } from "@/lib/identity/vc-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { byteaToHex, hexToByteaLiteral } from "@/lib/utils/bytea";

const MAX_VALIDITY_S = 365 * 24 * 60 * 60;
const GRACE_S = 24 * 60 * 60;

export type IssueResult = {
  ok: true;
  status: "active" | "pending";
  touristId: string;
  digitalId: string;
  tokenId: string | null;
  txHash: string | null;
  explorerUrl: string | null;
  chainId: number;
  contract: Address;
  holderAddress: Address;
  kycCommitment: Hex;
  itineraryHash: Hex;
  itineraryId: string | null;
  kycStatus: KycStatus;
  vcPath: string | null;
  qr: QrPayload;
  idempotent: boolean;
};

type ExistingBundle = {
  touristId: string;
  digitalId: string;
  hdIndex: number;
  holderAddress: Address;
  commitment: Hex;
  itineraryHashValue: Hex;
  validFrom: bigint;
  validUntil: bigint;
  metadataURI: string;
  tokenId: string | null;
  txHash: string | null;
  vcPath: string | null;
  status: string;
  kycType: string;
  nationality: string;
  kycStatus: KycStatus;
  itineraryId: string | null;
};

function validityWindow(tripStart: string, tripEnd: string): {
  validFrom: bigint;
  validUntil: bigint;
} {
  const validFrom = BigInt(toUnixSeconds(tripStart));
  let validUntil = BigInt(toUnixSeconds(tripEnd) + GRACE_S);
  if (validUntil - validFrom > BigInt(MAX_VALIDITY_S)) {
    validUntil = validFrom + BigInt(MAX_VALIDITY_S);
  }
  return { validFrom, validUntil };
}

async function encryptKyc(normalised: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("encrypt_pii", {
    p_plaintext: normalised,
    p_key: piiEncryptionKey(),
  });
  if (error || data === null || data === undefined) {
    throw new Error(error?.message ?? "encrypt_pii failed");
  }
  if (typeof data === "string" && data.length > 0) {
    return data;
  }
  try {
    return hexToByteaLiteral(byteaToHex(data));
  } catch {
    throw new Error("encrypt_pii returned a non-bytea value");
  }
}

async function findExisting(
  request: IssueIdentityRequest,
  last4: string,
): Promise<ExistingBundle | null> {
  if (!request.name || !request.kycType) {
    return null;
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tourists")
    .select(
      "id, hd_index, wallet_address, nationality, kyc_type, kyc_status, digital_ids ( id, kyc_commitment, itinerary_hash, metadata_uri, valid_from, valid_until, token_id, issue_tx_hash, vc_path, status, holder_address )",
    )
    .eq("full_name", request.name)
    .eq("kyc_type", request.kycType)
    .eq("kyc_last4", last4)
    .eq("trip_start", request.tripStart)
    .eq("trip_end", request.tripEnd)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const ids = Array.isArray(data.digital_ids)
    ? data.digital_ids
    : data.digital_ids
      ? [data.digital_ids]
      : [];
  const inflight = ids.find(
    (row) =>
      row &&
      typeof row === "object" &&
      "status" in row &&
      (row.status === "pending" || row.status === "active"),
  ) as
    | {
        id: string;
        kyc_commitment: string;
        itinerary_hash: string | null;
        metadata_uri: string | null;
        valid_from: string;
        valid_until: string;
        token_id: string | number | null;
        issue_tx_hash: string | null;
        vc_path: string | null;
        status: string;
        holder_address: string;
      }
    | undefined;

  if (!inflight || !data.wallet_address || data.hd_index === null) {
    return null;
  }

  return {
    touristId: String(data.id),
    digitalId: inflight.id,
    hdIndex: Number(data.hd_index),
    holderAddress: String(data.wallet_address) as Address,
    commitment: inflight.kyc_commitment as Hex,
    itineraryHashValue: (inflight.itinerary_hash ??
      "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex,
    validFrom: BigInt(Math.floor(new Date(inflight.valid_from).getTime() / 1000)),
    validUntil: BigInt(Math.floor(new Date(inflight.valid_until).getTime() / 1000)),
    metadataURI: inflight.metadata_uri ?? vcPublicUrl(vcObjectPath(inflight.id)),
    tokenId: inflight.token_id === null ? null : String(inflight.token_id),
    txHash: inflight.issue_tx_hash,
    vcPath: inflight.vc_path,
    status: inflight.status,
    kycType: String(data.kyc_type),
    nationality: String(data.nationality ?? "IN"),
    kycStatus: (data.kyc_status as KycStatus | null) ?? "pending",
    itineraryId: null,
  };
}

type TouristRow = {
  id: string;
  hdIndex: number | null;
  walletAddress: Address | null;
  kycType: string;
  nationality: string;
  kycStatus: KycStatus;
};

async function findTouristByProfileId(
  profileId: string,
): Promise<TouristRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tourists")
    .select("id, hd_index, wallet_address, nationality, kyc_type, kyc_status")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    id: String(data.id),
    hdIndex: data.hd_index === null ? null : Number(data.hd_index),
    walletAddress: data.wallet_address
      ? (String(data.wallet_address) as Address)
      : null,
    kycType: String(data.kyc_type),
    nationality: String(data.nationality ?? "IN"),
    kycStatus: (data.kyc_status as KycStatus | null) ?? "pending",
  };
}

async function loadInflightForTourist(
  touristId: string,
  kycType: string,
  nationality: string,
  hdIndex: number,
  holderAddress: Address,
  kycStatus: KycStatus,
): Promise<ExistingBundle | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("digital_ids")
    .select(
      "id, kyc_commitment, itinerary_hash, metadata_uri, valid_from, valid_until, token_id, issue_tx_hash, vc_path, status, holder_address",
    )
    .eq("tourist_id", touristId)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    touristId,
    digitalId: String(data.id),
    hdIndex,
    holderAddress: (data.holder_address as Address | null) ?? holderAddress,
    commitment: data.kyc_commitment as Hex,
    itineraryHashValue: (data.itinerary_hash ??
      "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex,
    validFrom: BigInt(Math.floor(new Date(String(data.valid_from)).getTime() / 1000)),
    validUntil: BigInt(Math.floor(new Date(String(data.valid_until)).getTime() / 1000)),
    metadataURI: data.metadata_uri ?? vcPublicUrl(vcObjectPath(String(data.id))),
    tokenId: data.token_id === null ? null : String(data.token_id),
    txHash: data.issue_tx_hash,
    vcPath: data.vc_path,
    status: String(data.status),
    kycType,
    nationality,
    kycStatus,
    itineraryId: null,
  };
}

async function ensureTouristWallet(
  touristId: string,
  hdIndex: number | null,
  walletAddress: Address | null,
): Promise<{ hdIndex: number; address: Address }> {
  if (
    hdIndex !== null &&
    Number.isInteger(hdIndex) &&
    walletAddress &&
    walletAddress.startsWith("0x") &&
    walletAddress.length === 42
  ) {
    return { hdIndex, address: walletAddress };
  }
  const wallet =
    hdIndex !== null && Number.isInteger(hdIndex)
      ? { hdIndex, address: deriveTouristAddress(hdIndex) }
      : await allocateTouristWallet();
  const admin = createAdminClient();
  const { error } = await admin
    .from("tourists")
    .update({
      hd_index: wallet.hdIndex,
      wallet_address: wallet.address,
    })
    .eq("id", touristId);
  if (error) {
    throw new Error(error.message);
  }
  return wallet;
}

function toResult(
  bundle: ExistingBundle,
  opts: { idempotent: boolean; sig: string | null },
): IssueResult {
  const qr: QrPayload = {
    v: 1,
    kind: "sts-id",
    chainId: activeChainId(),
    contract: registryAddress(),
    tokenId: bundle.tokenId,
    digitalId: bundle.digitalId,
    touristId: bundle.touristId,
    vcPath: bundle.vcPath,
    sig: opts.sig,
    kycStatus: bundle.kycStatus,
  };
  return {
    ok: true,
    status: bundle.status === "active" ? "active" : "pending",
    touristId: bundle.touristId,
    digitalId: bundle.digitalId,
    tokenId: bundle.tokenId,
    txHash: bundle.txHash,
    explorerUrl: explorerTxUrl(bundle.txHash as Hex | null),
    chainId: activeChainId(),
    contract: registryAddress(),
    holderAddress: bundle.holderAddress,
    kycCommitment: bundle.commitment,
    itineraryHash: bundle.itineraryHashValue,
    itineraryId: bundle.itineraryId,
    kycStatus: bundle.kycStatus,
    vcPath: bundle.vcPath,
    qr,
    idempotent: opts.idempotent,
  };
}

async function submitOnChain(bundle: ExistingBundle): Promise<IssueResult> {
  const admin = createAdminClient();
  try {
    const issued = await issueIdentity({
      to: bundle.holderAddress,
      kycCommitment: bundle.commitment,
      itineraryHash: bundle.itineraryHashValue,
      validFrom: bundle.validFrom,
      validUntil: bundle.validUntil,
      kycType: kycTypeToUint8(bundle.kycType),
      nationality: nationalityToBytes2(bundle.nationality),
      metadataURI: bundle.metadataURI,
    });

    const stored = await buildAndStoreVc({
      digitalId: bundle.digitalId,
      tokenId: issued.tokenId,
      holder: bundle.holderAddress,
      kycCommitment: bundle.commitment,
      itineraryHash: bundle.itineraryHashValue,
      validFrom: bundle.validFrom,
      validUntil: bundle.validUntil,
      kycType: kycTypeToUint8(bundle.kycType),
      nationality: bundle.nationality,
    });

    await admin
      .from("digital_ids")
      .update({
        token_id: issued.tokenId.toString(),
        issue_tx_hash: issued.txHash,
        issue_block: Number(issued.blockNumber),
        status: "active",
        vc_path: stored?.path ?? bundle.vcPath,
        vc_sha256: stored?.sha256 ?? null,
        metadata_uri: stored?.publicUrl ?? bundle.metadataURI,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bundle.digitalId);

    await admin
      .from("chain_anchors")
      .update({
        status: "confirmed",
        tx_hash: issued.txHash,
        block_number: Number(issued.blockNumber),
        error: null,
        confirmed_at: new Date().toISOString(),
      })
      .eq("subject_id", bundle.digitalId)
      .eq("kind", "id_issue");

    identityLog("issue_confirmed", {
      touristId: bundle.touristId,
      digitalId: bundle.digitalId,
      tokenId: issued.tokenId.toString(),
    });

    return toResult(
      {
        ...bundle,
        tokenId: issued.tokenId.toString(),
        txHash: issued.txHash,
        vcPath: stored?.path ?? bundle.vcPath,
        status: "active",
      },
      { idempotent: false, sig: stored?.signature ?? null },
    );
  } catch (cause) {
    if (!(cause instanceof ChainDisabledError)) {
      const message = cause instanceof Error ? cause.message : "chain write failed";
      await admin
        .from("chain_anchors")
        .update({
          status: "failed",
          error: message,
        })
        .eq("subject_id", bundle.digitalId)
        .eq("kind", "id_issue");
      identityLog("issue_chain_failed", {
        touristId: bundle.touristId,
        digitalId: bundle.digitalId,
        pending: true,
      });
    } else {
      const now = new Date().toISOString();
      await admin
        .from("digital_ids")
        .update({
          status: "active",
          updated_at: now,
        })
        .eq("id", bundle.digitalId);
      await admin
        .from("chain_anchors")
        .update({
          status: "confirmed",
          error: "chain_disabled",
          confirmed_at: now,
        })
        .eq("subject_id", bundle.digitalId)
        .eq("kind", "id_issue");
      identityLog("issue_chain_skipped", {
        touristId: bundle.touristId,
        digitalId: bundle.digitalId,
        pending: false,
      });
      return toResult(
        { ...bundle, status: "active" },
        { idempotent: false, sig: null },
      );
    }
    return toResult(bundle, { idempotent: false, sig: null });
  }
}

async function writeItinerary(
  touristId: string,
  request: IssueIdentityRequest | SaveItineraryRequest,
  tripStart: string,
  tripEnd: string,
): Promise<string | null> {
  const plan = resolveItinerary(request);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("insert_itinerary_from_geojson", {
    p_tourist_id: touristId,
    p_title: plan.title,
    p_geojson: plan.geojson,
    p_corridor_m: plan.corridorM,
    p_waypoints: plan.waypoints,
    p_starts_at: tripStart,
    p_ends_at: tripEnd,
  });
  if (error) {
    identityLog("itinerary_insert_failed", { touristId, ok: false });
    throw new Error(error.message);
  }
  if (plan.entryPoint) {
    await admin
      .from("tourists")
      .update({ entry_point: plan.entryPoint })
      .eq("id", touristId);
  }
  return typeof data === "string" ? data : null;
}

async function persistDigitalId(args: {
  touristId: string;
  wallet: { hdIndex: number; address: Address };
  request: IssueIdentityRequest;
  normalised: string;
  last4: string;
  kycType: string;
  nationality: string;
  kycStatus: KycStatus;
  name: string;
  preserveKyc?: boolean;
}): Promise<ExistingBundle> {
  const plan = resolveIssuePlan(args.request);
  const itinerary = plan.geojson;
  const routeHash = itineraryHash(itinerary);
  const salt = bytesToHex(randomBytes(32));
  const commitment = kycCommitment(
    kycTypeToUint8(args.kycType),
    args.normalised,
    salt,
  );
  const { validFrom, validUntil } = validityWindow(
    args.request.tripStart,
    args.request.tripEnd,
  );
  const admin = createAdminClient();
  const touristId = args.touristId;

  const touristPatch: Record<string, unknown> = {
    trip_start: args.request.tripStart,
    trip_end: args.request.tripEnd,
    entry_point: plan.entryPoint,
    hd_index: args.wallet.hdIndex,
    wallet_address: args.wallet.address,
    status: "active",
  };

  if (!args.preserveKyc) {
    const ciphertext = await encryptKyc(args.normalised);
    touristPatch.full_name = args.name;
    touristPatch.nationality = args.nationality;
    touristPatch.date_of_birth = args.request.dateOfBirth ?? null;
    touristPatch.kyc_type = args.kycType;
    touristPatch.kyc_number_enc = ciphertext;
    touristPatch.kyc_last4 = args.last4;
    touristPatch.kyc_salt = hexToByteaLiteral(salt);
    touristPatch.kyc_status = args.kycStatus;
    touristPatch.phone_e164 = args.request.phone ?? null;
    touristPatch.email = args.request.email ?? null;
    touristPatch.emergency_contacts = args.request.emergencyContacts ?? [];
  }

  const { error: updateError } = await admin
    .from("tourists")
    .update(touristPatch)
    .eq("id", touristId);
  if (updateError) {
    throw new Error(updateError.message);
  }

  const itineraryId = await writeItinerary(
    touristId,
    args.request,
    args.request.tripStart,
    args.request.tripEnd,
  );

  const inflight = await admin
    .from("digital_ids")
    .select("id")
    .eq("tourist_id", touristId)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const digitalId = inflight.data?.id ? String(inflight.data.id) : crypto.randomUUID();
  const metadataURI = isZeroHex(registryAddress())
    ? `supabase://did/${digitalId}.json`
    : vcPublicUrl(vcObjectPath(digitalId));

  if (inflight.data?.id) {
    const { error: didError } = await admin
      .from("digital_ids")
      .update({
        holder_address: args.wallet.address,
        kyc_commitment: commitment,
        itinerary_hash: routeHash,
        metadata_uri: metadataURI,
        valid_from: new Date(Number(validFrom) * 1000).toISOString(),
        valid_until: new Date(Number(validUntil) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", digitalId);
    if (didError) {
      throw new Error(didError.message);
    }
  } else {
    const { error: didError } = await admin.from("digital_ids").insert({
      id: digitalId,
      tourist_id: touristId,
      chain_id: publicChainId(),
      contract_address: registryAddress(),
      holder_address: args.wallet.address,
      kyc_commitment: commitment,
      itinerary_hash: routeHash,
      metadata_uri: metadataURI,
      valid_from: new Date(Number(validFrom) * 1000).toISOString(),
      valid_until: new Date(Number(validUntil) * 1000).toISOString(),
      status: "pending",
    });
    if (didError) {
      throw new Error(didError.message);
    }

    await admin.from("chain_anchors").insert({
      kind: "id_issue",
      subject_id: digitalId,
      record_hash: commitment,
      chain_id: publicChainId(),
      contract_address: registryAddress(),
      status: "pending",
    });
  }

  identityLog("issue_pending", {
    touristId,
    digitalId,
    bucket: storageBuckets().public,
  });

  return {
    touristId,
    digitalId,
    hdIndex: args.wallet.hdIndex,
    holderAddress: args.wallet.address,
    commitment,
    itineraryHashValue: routeHash,
    validFrom,
    validUntil,
    metadataURI,
    tokenId: null,
    txHash: null,
    vcPath: null,
    status: "pending",
    kycType: args.kycType,
    nationality: args.nationality,
    kycStatus: args.kycStatus,
    itineraryId,
  };
}

export async function saveTouristItinerary(
  touristId: string,
  request: SaveItineraryRequest,
  tripStart: string,
  tripEnd: string,
): Promise<string | null> {
  return writeItinerary(touristId, request, tripStart, tripEnd);
}

export async function issueTouristIdentity(
  request: IssueIdentityRequest,
): Promise<IssueResult> {
  const plan = resolveIssuePlan(request);
  const normalised = normaliseKycNumber(plan.kycNumber);
  const last4 = kycLast4(normalised);

  const byProfile = request.profileId
    ? await findTouristByProfileId(request.profileId)
    : null;
  const existing = byProfile ? null : await findExisting(request, last4);

  if (existing) {
    identityLog("issue_idempotent", {
      touristId: existing.touristId,
      digitalId: existing.digitalId,
      status: existing.status,
    });
    if (existing.status === "active" && (plan.skipKyc || existing.kycStatus === "verified")) {
      await writeItinerary(
        existing.touristId,
        request,
        request.tripStart,
        request.tripEnd,
      ).catch(() => null);
      return toResult(existing, { idempotent: true, sig: null });
    }
    if (!plan.skipKyc && existing.kycStatus === "skipped") {
      const wallet = await ensureTouristWallet(
        existing.touristId,
        existing.hdIndex,
        existing.holderAddress,
      );
      const bundle = await persistDigitalId({
        touristId: existing.touristId,
        wallet,
        request,
        normalised,
        last4,
        kycType: plan.kycType,
        nationality: plan.nationality,
        kycStatus: plan.kycStatus,
        name: plan.name,
      });
      return submitOnChain({ ...bundle, tokenId: existing.tokenId, txHash: existing.txHash, status: existing.status });
    }
    const retried = await submitOnChain(existing);
    return { ...retried, idempotent: true };
  }

  if (byProfile) {
    const preserveKyc = plan.skipKyc && byProfile.kycStatus !== "skipped";
    const kycType = preserveKyc ? byProfile.kycType : plan.kycType;
    const nationality = preserveKyc ? byProfile.nationality : plan.nationality;
    const kycStatus = preserveKyc ? byProfile.kycStatus : plan.kycStatus;
    const wallet = await ensureTouristWallet(
      byProfile.id,
      byProfile.hdIndex,
      byProfile.walletAddress,
    );
    const inflight = await loadInflightForTourist(
      byProfile.id,
      kycType,
      nationality,
      wallet.hdIndex,
      wallet.address,
      kycStatus,
    );
    if (inflight) {
      const shouldUpgrade = !plan.skipKyc && byProfile.kycStatus === "skipped";
      if (shouldUpgrade) {
        const bundle = await persistDigitalId({
          touristId: byProfile.id,
          wallet,
          request,
          normalised,
          last4,
          kycType: plan.kycType,
          nationality: plan.nationality,
          kycStatus: plan.kycStatus,
          name: plan.name,
        });
        return submitOnChain({
          ...bundle,
          tokenId: inflight.tokenId,
          txHash: inflight.txHash,
          status: inflight.status === "active" ? "pending" : inflight.status,
        });
      }
      identityLog("issue_idempotent", {
        touristId: inflight.touristId,
        digitalId: inflight.digitalId,
        status: inflight.status,
      });
      await writeItinerary(
        byProfile.id,
        request,
        request.tripStart,
        request.tripEnd,
      ).catch(() => null);
      if (inflight.status === "active") {
        return toResult(inflight, { idempotent: true, sig: null });
      }
      const retried = await submitOnChain(inflight);
      return { ...retried, idempotent: true };
    }
    const bundle = await persistDigitalId({
      touristId: byProfile.id,
      wallet,
      request,
      normalised: preserveKyc ? `preserved:${byProfile.id}` : normalised,
      last4: preserveKyc ? "0000" : last4,
      kycType,
      nationality,
      kycStatus,
      name: plan.name,
      preserveKyc,
    });
    return submitOnChain(bundle);
  }

  const wallet = await allocateTouristWallet();
  const admin = createAdminClient();
  const ciphertext = await encryptKyc(normalised);

  const { data: tourist, error: touristError } = await admin
    .from("tourists")
    .insert({
      profile_id: request.profileId ?? null,
      full_name: plan.name,
      nationality: plan.nationality,
      date_of_birth: request.dateOfBirth ?? null,
      kyc_type: plan.kycType,
      kyc_number_enc: ciphertext,
      kyc_last4: last4,
      kyc_salt: hexToByteaLiteral(bytesToHex(randomBytes(32))),
      kyc_status: plan.kycStatus,
      phone_e164: request.phone ?? null,
      email: request.email ?? null,
      emergency_contacts: request.emergencyContacts ?? [],
      trip_start: request.tripStart,
      trip_end: request.tripEnd,
      entry_point: plan.entryPoint,
      hd_index: wallet.hdIndex,
      wallet_address: wallet.address,
      status: "active",
    })
    .select("id")
    .single();

  if (touristError || !tourist) {
    throw new Error(touristError?.message ?? "tourist insert failed");
  }

  const bundle = await persistDigitalId({
    touristId: String(tourist.id),
    wallet,
    request,
    normalised,
    last4,
    kycType: plan.kycType,
    nationality: plan.nationality,
    kycStatus: plan.kycStatus,
    name: plan.name,
  });
  return submitOnChain(bundle);
}
