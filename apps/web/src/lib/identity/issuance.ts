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
  type QrPayload,
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
import { buildAndStoreVc, vcObjectPath, vcPublicUrl } from "@/lib/identity/vc-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { byteaToHex, hexToByteaLiteral } from "@/lib/utils/bytea";

const MAX_VALIDITY_S = 365 * 24 * 60 * 60;
const GRACE_S = 24 * 60 * 60;

const DEFAULT_ITINERARY = {
  type: "LineString" as const,
  coordinates: [
    [91.7362, 26.1445],
    [91.778, 26.121],
    [91.8631, 26.1],
    [91.893, 25.5788],
  ] as [number, number][],
};

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
  vcPath: string | null;
  qr: QrPayload | null;
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
};

function corridorM(request: IssueIdentityRequest): number {
  if (request.corridorM) {
    return request.corridorM;
  }
  const fromEnv = Number.parseInt(
    process.env.DEFAULT_ITINERARY_CORRIDOR_M ?? "2000",
    10,
  );
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 2000;
}

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
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tourists")
    .select(
      "id, hd_index, wallet_address, nationality, kyc_type, digital_ids ( id, kyc_commitment, itinerary_hash, metadata_uri, valid_from, valid_until, token_id, issue_tx_hash, vc_path, status, holder_address )",
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
  };
}

type TouristRow = {
  id: string;
  hdIndex: number | null;
  walletAddress: Address | null;
  kycType: string;
  nationality: string;
};

async function findTouristByProfileId(
  profileId: string,
): Promise<TouristRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tourists")
    .select("id, hd_index, wallet_address, nationality, kyc_type")
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
  };
}

async function loadInflightForTourist(
  touristId: string,
  kycType: string,
  nationality: string,
  hdIndex: number,
  holderAddress: Address,
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
  const tokenId = bundle.tokenId;
  const qr: QrPayload | null =
    tokenId && bundle.status === "active"
      ? {
          chainId: activeChainId(),
          contract: registryAddress(),
          tokenId,
          vcPath: bundle.vcPath,
          sig: opts.sig,
        }
      : null;
  return {
    ok: true,
    status: bundle.status === "active" ? "active" : "pending",
    touristId: bundle.touristId,
    digitalId: bundle.digitalId,
    tokenId,
    txHash: bundle.txHash,
    explorerUrl: explorerTxUrl(bundle.txHash as Hex | null),
    chainId: activeChainId(),
    contract: registryAddress(),
    holderAddress: bundle.holderAddress,
    kycCommitment: bundle.commitment,
    itineraryHash: bundle.itineraryHashValue,
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
      identityLog("issue_chain_skipped", {
        touristId: bundle.touristId,
        digitalId: bundle.digitalId,
        pending: true,
      });
    }
    return toResult(bundle, { idempotent: false, sig: null });
  }
}

async function persistDigitalId(args: {
  touristId: string;
  wallet: { hdIndex: number; address: Address };
  request: IssueIdentityRequest;
  normalised: string;
  last4: string;
}): Promise<ExistingBundle> {
  const itinerary = args.request.itineraryGeoJSON ?? DEFAULT_ITINERARY;
  const routeHash = itineraryHash(itinerary);
  const salt = bytesToHex(randomBytes(32));
  const commitment = kycCommitment(
    kycTypeToUint8(args.request.kycType),
    args.normalised,
    salt,
  );
  const { validFrom, validUntil } = validityWindow(
    args.request.tripStart,
    args.request.tripEnd,
  );
  const ciphertext = await encryptKyc(args.normalised);
  const admin = createAdminClient();
  const touristId = args.touristId;

  const { error: updateError } = await admin
    .from("tourists")
    .update({
      full_name: args.request.name,
      nationality: args.request.nationality,
      date_of_birth: args.request.dateOfBirth ?? null,
      kyc_type: args.request.kycType,
      kyc_number_enc: ciphertext,
      kyc_last4: args.last4,
      kyc_salt: hexToByteaLiteral(salt),
      phone_e164: args.request.phone ?? null,
      email: args.request.email ?? null,
      emergency_contacts: args.request.emergencyContacts ?? [],
      trip_start: args.request.tripStart,
      trip_end: args.request.tripEnd,
      entry_point: args.request.entryPoint ?? null,
      hd_index: args.wallet.hdIndex,
      wallet_address: args.wallet.address,
      status: "active",
    })
    .eq("id", touristId);
  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: itinError } = await admin.rpc("insert_itinerary_from_geojson", {
    p_tourist_id: touristId,
    p_title: args.request.itineraryTitle ?? "Planned route",
    p_geojson: itinerary,
    p_corridor_m: corridorM(args.request),
    p_waypoints: [],
    p_starts_at: args.request.tripStart,
    p_ends_at: args.request.tripEnd,
  });
  if (itinError) {
    identityLog("itinerary_insert_failed", { touristId, ok: false });
  }

  const digitalId = crypto.randomUUID();
  const metadataURI = isZeroHex(registryAddress())
    ? `supabase://did/${digitalId}.json`
    : vcPublicUrl(vcObjectPath(digitalId));

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
    kycType: args.request.kycType,
    nationality: args.request.nationality,
  };
}

export async function issueTouristIdentity(
  request: IssueIdentityRequest,
): Promise<IssueResult> {
  const normalised = normaliseKycNumber(request.kycNumber);
  const last4 = kycLast4(normalised);

  const byProfile = request.profileId
    ? await findTouristByProfileId(request.profileId)
    : null;
  const existing = byProfile
    ? null
    : await findExisting(request, last4);

  if (existing) {
    identityLog("issue_idempotent", {
      touristId: existing.touristId,
      digitalId: existing.digitalId,
      status: existing.status,
    });
    if (existing.status === "active") {
      return toResult(existing, { idempotent: true, sig: null });
    }
    const retried = await submitOnChain(existing);
    return { ...retried, idempotent: true };
  }

  if (byProfile) {
    const wallet = await ensureTouristWallet(
      byProfile.id,
      byProfile.hdIndex,
      byProfile.walletAddress,
    );
    const inflight = await loadInflightForTourist(
      byProfile.id,
      request.kycType,
      request.nationality,
      wallet.hdIndex,
      wallet.address,
    );
    if (inflight) {
      identityLog("issue_idempotent", {
        touristId: inflight.touristId,
        digitalId: inflight.digitalId,
        status: inflight.status,
      });
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
      normalised,
      last4,
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
      full_name: request.name,
      nationality: request.nationality,
      date_of_birth: request.dateOfBirth ?? null,
      kyc_type: request.kycType,
      kyc_number_enc: ciphertext,
      kyc_last4: last4,
      kyc_salt: hexToByteaLiteral(saltForInsert(normalised, request.kycType)),
      phone_e164: request.phone ?? null,
      email: request.email ?? null,
      emergency_contacts: request.emergencyContacts ?? [],
      trip_start: request.tripStart,
      trip_end: request.tripEnd,
      entry_point: request.entryPoint ?? null,
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
  });
  return submitOnChain(bundle);
}

function saltForInsert(_normalised: string, _kycType: string): Hex {
  return bytesToHex(randomBytes(32));
}
