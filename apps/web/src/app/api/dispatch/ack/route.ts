// apps/web/src/app/api/dispatch/ack/route.ts
import { ackIncident } from "@/lib/notify/lifecycle";
import { authorizeInternalOrStaff, jsonError } from "@/lib/notify/http";
import { dispatchAckBodySchema } from "@/lib/notify/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeInternalOrStaff(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid json", 400);
  }
  const parsed = dispatchAckBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "invalid body", 400);
  }

  const result = await ackIncident({
    incidentId: parsed.data.incidentId,
    actorLabel: parsed.data.actorLabel ?? auth.actorLabel,
  });
  if (!result.ok) {
    return jsonError(result.error, 400);
  }
  return Response.json({ ok: true, status: result.status });
}
