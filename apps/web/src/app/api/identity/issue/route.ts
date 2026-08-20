// apps/web/src/app/api/identity/issue/route.ts
import { issueIdentityRequestSchema } from "@sts/shared";
import { type NextRequest, NextResponse } from "next/server";

import {
  copyResponseCookies,
  ensureTouristSessionOnResponse,
  tryGetTouristUserId,
} from "@/lib/auth/guest-session";
import { issueTouristIdentity } from "@/lib/identity/issuance";
import { identityLog } from "@/lib/identity/log";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = issueIdentityRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "validation_failed";
    return NextResponse.json(
      { ok: false, error: first, details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const sessionCookies = NextResponse.json({ ok: true });
  const input = { ...parsed.data };
  if (!input.profileId) {
    input.profileId = (await tryGetTouristUserId(request)) ?? undefined;
  }
  if (!input.profileId) {
    const minted = await ensureTouristSessionOnResponse({
      request,
      response: sessionCookies,
      displayName: input.name,
    });
    if (minted) input.profileId = minted.userId;
  }
  if (!input.profileId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not start a tourist session. Use DigiLocker or Anonymous demo tourist, then issue the ID again.",
      },
      { status: 401 },
    );
  }

  try {
    const result = await issueTouristIdentity(input);
    identityLog("issue_http", {
      touristId: result.touristId,
      status: result.status,
      idempotent: result.idempotent,
    });
    const response = NextResponse.json(result, {
      status: result.status === "active" ? 201 : 202,
    });
    return copyResponseCookies(sessionCookies, response);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "issue failed";
    identityLog("issue_http_error", { ok: false, error: message });
    const response = NextResponse.json({ ok: false, error: message }, { status: 500 });
    return copyResponseCookies(sessionCookies, response);
  }
}
