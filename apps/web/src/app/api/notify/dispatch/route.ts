// apps/web/src/app/api/notify/dispatch/route.ts
import { dispatchIncidentNotifications } from "@/lib/notify/dispatcher";
import { authorizeInternalOrStaff, jsonError } from "@/lib/notify/http";
import { pipelineIncidentSchema } from "@/lib/notify/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeInternalOrStaff(request);
  if (auth instanceof Response) return auth;

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
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "dispatch failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
