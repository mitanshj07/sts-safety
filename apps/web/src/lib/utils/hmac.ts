// apps/web/src/lib/utils/hmac.ts
import "server-only";

import { timingSafeEqual } from "node:crypto";

import { pipelineSecret } from "@/lib/chain/env";

const HEADER = "x-pipeline-secret";

function toBuffer(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

/** Timing-safe compare of `x-pipeline-secret` against PIPELINE_SECRET. */
export function verifyPipelineSecret(request: Request): boolean {
  const expected = pipelineSecret();
  const provided = request.headers.get(HEADER);
  if (!expected || !provided) {
    return false;
  }
  const a = toBuffer(expected);
  const b = toBuffer(provided);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function unauthorizedPipeline(): Response {
  return Response.json(
    { ok: false, error: "invalid pipeline secret" },
    { status: 401 },
  );
}
