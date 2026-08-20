// apps/web/src/app/api/identity/digilocker/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";

import {
  DIGILOCKER_OAUTH_COOKIE,
  DIGILOCKER_SESSION_COOKIE,
  completeDigilocker,
  cookieOptions,
  decodeOAuthCookie,
  digilockerErrorReason,
  encodeSessionCookie,
  flowStatusUrl,
} from "@/lib/identity/digilocker";
import { ensureTouristSessionAfterDigilocker } from "@/lib/identity/digilocker-session";
import { identityLog } from "@/lib/identity/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearOauth(response: NextResponse): NextResponse {
  response.cookies.set(DIGILOCKER_OAUTH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const oauth = decodeOAuthCookie(request.cookies.get(DIGILOCKER_OAUTH_COOKIE)?.value);
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const intent = oauth?.intent;

  if (error) {
    identityLog("digilocker_denied", { ok: false });
    return clearOauth(NextResponse.redirect(flowStatusUrl(request, intent, "denied")));
  }

  if (!oauth || !code || state !== oauth.state) {
    identityLog("digilocker_state_mismatch", { ok: false });
    return clearOauth(
      NextResponse.redirect(flowStatusUrl(request, intent, "error", "state")),
    );
  }

  try {
    const session = await completeDigilocker({ request, code, oauth });
    const response = NextResponse.redirect(flowStatusUrl(request, intent, "ok"));
    clearOauth(response);
    response.cookies.set(
      DIGILOCKER_SESSION_COOKIE,
      encodeSessionCookie(session),
      cookieOptions(),
    );
    await ensureTouristSessionAfterDigilocker({
      request,
      response,
      displayName: session.name,
    });
    identityLog("digilocker_callback_ok", { ok: true, docs: session.documents.length });
    return response;
  } catch (err) {
    const reason = digilockerErrorReason(err);
    identityLog("digilocker_callback_failed", { ok: false, reason });
    return clearOauth(
      NextResponse.redirect(flowStatusUrl(request, intent, "error", reason)),
    );
  }
}
