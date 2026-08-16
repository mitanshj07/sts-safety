// apps/web/src/lib/notify/http.ts
import "server-only";

import { getPrincipal } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/roles";
import { verifyPipelineSecret } from "@/lib/utils/hmac";

export async function authorizeInternalOrStaff(
  request: Request,
): Promise<{ actorLabel: string } | Response> {
  if (verifyPipelineSecret(request)) {
    return { actorLabel: "pipeline" };
  }
  try {
    const principal = await getPrincipal(request);
    if (principal && isStaffRole(principal.role)) {
      return { actorLabel: `staff:${principal.role}` };
    }
  } catch {
    // fall through
  }
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}
