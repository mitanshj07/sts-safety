import { sendTouristNote } from "@/lib/notify/lifecycle";
import { authorizeInternalOrStaff, jsonError } from "@/lib/notify/http";
import { touristNoteBodySchema } from "@/lib/notify/schemas";
import { clientKey, rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeInternalOrStaff(request);
  if (auth instanceof Response) return auth;

  const limited = rateLimit({ key: `note:${clientKey(request)}`, capacity: 30 });
  if (!limited.ok) return rateLimitResponse(limited);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid json", 400);
  }
  const parsed = touristNoteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "invalid body", 400);
  }

  const result = await sendTouristNote({
    incidentId: parsed.data.incidentId,
    body: parsed.data.body,
    presetId: parsed.data.presetId,
    actorLabel: parsed.data.actorLabel ?? auth.actorLabel,
  });
  if (!result.ok) {
    return jsonError(result.error, 400);
  }
  return Response.json({
    ok: true,
    status: result.status,
    delivered: result.delivered ?? 0,
  });
}
