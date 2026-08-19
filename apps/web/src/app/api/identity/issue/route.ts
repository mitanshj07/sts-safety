// apps/web/src/app/api/identity/issue/route.ts
import { issueIdentityRequestSchema } from "@sts/shared";

import { getPrincipal } from "@/lib/auth/guards";
import { issueTouristIdentity } from "@/lib/identity/issuance";
import { identityLog } from "@/lib/identity/log";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = issueIdentityRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "validation_failed";
    return Response.json(
      { ok: false, error: first, details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const principal = await getPrincipal(request).catch(() => null);
  if (!principal) {
    return Response.json({ ok: false, error: "sign in to issue an ID" }, { status: 401 });
  }

  const input = { ...parsed.data };
  if (principal.role === "tourist") {
    input.profileId = principal.id;
  } else if (!input.profileId) {
    return Response.json(
      { ok: false, error: "profileId required for desk issuance" },
      { status: 400 },
    );
  }

  try {
    const result = await issueTouristIdentity(input);
    identityLog("issue_http", {
      touristId: result.touristId,
      status: result.status,
      idempotent: result.idempotent,
      kycStatus: result.kycStatus,
    });
    return Response.json(result, { status: result.status === "active" ? 201 : 202 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "issue failed";
    identityLog("issue_http_error", { ok: false, error: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
