// apps/web/src/app/api/identity/verify-kyc/route.ts
import { KYC_TYPE_ORDINAL, normaliseKycNumber, verifyKycRequestSchema } from "@sts/shared";

import { verifyKycOnChain } from "@/lib/chain/registry";
import { identityLog } from "@/lib/identity/log";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = verifyKycRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const kycType = KYC_TYPE_ORDINAL[parsed.data.kycType];
  const normalised = normaliseKycNumber(parsed.data.kycNumber);

  try {
    const matches = await verifyKycOnChain({
      tokenId: parsed.data.tokenId,
      kycType,
      kycNumber: normalised,
      salt: parsed.data.salt as `0x${string}`,
    });
    identityLog("verify_kyc_http", {
      tokenId: parsed.data.tokenId.toString(),
      matches,
    });
    return Response.json({
      ok: true,
      matches,
      tokenId: parsed.data.tokenId.toString(),
      reason: matches ? "KYC_MATCH" : "KYC_MISMATCH",
    });
  } catch (cause) {
    identityLog("verify_kyc_http_error", {
      tokenId: parsed.data.tokenId.toString(),
      ok: false,
    });
    const message = cause instanceof Error ? cause.message : "verifyKyc failed";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
