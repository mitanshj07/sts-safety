// apps/web/src/app/api/pipeline/incident/route.ts
import { dispatchIncidentNotifications } from "@/lib/notify/dispatcher";
import { jsonError } from "@/lib/notify/http";
import { pipelineIncidentSchema } from "@/lib/notify/schemas";
import { unauthorizedPipeline, verifyPipelineSecret } from "@/lib/utils/hmac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * pg_net target after an incident insert. Enrichment/AI (Phase 11) can extend
 * this handler; fan-out must run even if chain/LLM/ML are down.
 */
export async function POST(request: Request): Promise<Response> {
  if (!verifyPipelineSecret(request)) {
    return unauthorizedPipeline();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid json", 400);
  }
  const parsed = pipelineIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "invalid body", 400);
  }

  try {
    const result = await dispatchIncidentNotifications(parsed.data.incident_id);
    return Response.json({ ok: true, dispatched: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "pipeline failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
