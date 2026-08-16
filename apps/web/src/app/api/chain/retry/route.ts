// apps/web/src/app/api/chain/retry/route.ts
import { drainPendingAnchors } from "@/lib/chain/anchor";
import { unauthorizedPipeline, verifyPipelineSecret } from "@/lib/utils/hmac";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!verifyPipelineSecret(request)) {
    return unauthorizedPipeline();
  }

  try {
    const result = await drainPendingAnchors();
    return Response.json({ ok: true, ...result });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "retry failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
