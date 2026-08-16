// apps/web/src/lib/identity/vc-store.ts
import "server-only";

import type { Address, Hex } from "viem";

import { buildAndSignVc } from "@/lib/chain/vc";
import { storageBuckets } from "@/lib/chain/env";
import { identityLog } from "@/lib/identity/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseUrl } from "@/lib/supabase/config";

export type StoredVc = {
  path: string;
  sha256: Hex;
  publicUrl: string;
  signature: Hex;
};

async function ensurePublicBucket(bucket: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 262144,
  });
  if (error && !/already exists/i.test(error.message)) {
    identityLog("storage_bucket", { bucket, ok: false });
  }
}

export function vcObjectPath(digitalId: string): string {
  return `did/${digitalId}.json`;
}

export function vcPublicUrl(path: string): string {
  const bucket = storageBuckets().public;
  const base = getSupabaseUrl().replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export async function buildAndStoreVc(args: {
  digitalId: string;
  tokenId: bigint;
  holder: Address;
  kycCommitment: Hex;
  itineraryHash: Hex;
  validFrom: bigint;
  validUntil: bigint;
  kycType: number;
  nationality: string;
}): Promise<StoredVc | null> {
  try {
    const { vc, sha256hex } = await buildAndSignVc({
      id: args.digitalId,
      tokenId: args.tokenId,
      holder: args.holder,
      kycCommitment: args.kycCommitment,
      itineraryHash: args.itineraryHash,
      validFrom: args.validFrom,
      validUntil: args.validUntil,
      kycType: args.kycType,
      nationality: args.nationality,
    });
    const bucket = storageBuckets().public;
    await ensurePublicBucket(bucket);
    const path = vcObjectPath(args.digitalId);
    const admin = createAdminClient();
    const body = JSON.stringify(vc);
    const { error } = await admin.storage.from(bucket).upload(path, body, {
      contentType: "application/json",
      upsert: true,
    });
    if (error) {
      identityLog("vc_upload_failed", { digitalId: args.digitalId, ok: false });
      return null;
    }
    await admin
      .from("digital_ids")
      .update({
        vc_path: path,
        vc_sha256: sha256hex,
        metadata_uri: vcPublicUrl(path),
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.digitalId);
    return {
      path,
      sha256: sha256hex,
      publicUrl: vcPublicUrl(path),
      signature: vc.proof.proofValue as Hex,
    };
  } catch {
    identityLog("vc_sign_failed", { digitalId: args.digitalId, ok: false });
    return null;
  }
}

export async function downloadVcJson(path: string): Promise<unknown | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(storageBuckets().public)
    .download(path);
  if (error || !data) {
    return null;
  }
  try {
    return JSON.parse(await data.text()) as unknown;
  } catch {
    return null;
  }
}
