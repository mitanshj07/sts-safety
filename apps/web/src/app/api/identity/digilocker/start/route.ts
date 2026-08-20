// apps/web/src/app/api/identity/digilocker/start/route.ts
import { NextResponse, type NextRequest } from "next/server";

import { getPrincipal } from "@/lib/auth/guards";
import { homePathForRole } from "@/lib/auth/roles";
import {
  DIGILOCKER_OAUTH_COOKIE,
  cookieOptions,
  encodeOAuthCookie,
  flowStatusUrl,
  newOAuthState,
  oauthIntentFromRequest,
  startRedirectUrl,
} from "@/lib/identity/digilocker";
import { identityLog } from "@/lib/identity/log";
import { tryGetSupabasePublicConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  let hasTourist = false;
  if (tryGetSupabasePublicConfig()) {
    let principal = null;
    try {
      principal = await getPrincipal(request);
    } catch {
      principal = null;
    }
    if (principal && principal.role !== "tourist") {
      return NextResponse.redirect(
        new URL(homePathForRole(principal.role), request.url),
      );
    }
    hasTourist = principal?.role === "tourist";
  }

  const intent = oauthIntentFromRequest(request, hasTourist);
  try {
    const oauth = newOAuthState(intent);
    const dest = startRedirectUrl(request, oauth);
    if (!dest.url) {
      identityLog("digilocker_start_blocked", { ok: false, reason: dest.reason ?? "config" });
      return NextResponse.redirect(
        flowStatusUrl(request, intent, "error", dest.reason ?? "config"),
      );
    }

    identityLog("digilocker_start", {
      ok: true,
      demo: dest.url.includes("/login/digilocker"),
      intent,
    });
    const response = NextResponse.redirect(dest.url);
    response.cookies.set(DIGILOCKER_OAUTH_COOKIE, encodeOAuthCookie(oauth), cookieOptions());
    return response;
  } catch {
    identityLog("digilocker_start_failed", { ok: false, reason: "config" });
    return NextResponse.redirect(flowStatusUrl(request, intent, "error", "config"));
  }
}
