// apps/web/src/app/api/identity/digilocker/start/route.ts
import { NextResponse, type NextRequest } from "next/server";

import { getPrincipal } from "@/lib/auth/guards";
import { homePathForRole } from "@/lib/auth/roles";
import {
  DIGILOCKER_OAUTH_COOKIE,
  cookieOptions,
  encodeOAuthCookie,
  newOAuthState,
  requestOrigin,
  startRedirectUrl,
} from "@/lib/identity/digilocker";
import { identityLog } from "@/lib/identity/log";
import { tryGetSupabasePublicConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = requestOrigin(request);
  if (tryGetSupabasePublicConfig()) {
    let principal = null;
    try {
      principal = await getPrincipal(request);
    } catch {
      principal = null;
    }
    if (principal && principal.role !== "tourist") {
      return NextResponse.redirect(new URL(homePathForRole(principal.role), origin));
    }
    if (!principal) {
      const login = new URL("/login", origin);
      login.searchParams.set("next", "/onboard");
      return NextResponse.redirect(login);
    }
  }

  const oauth = newOAuthState();
  const dest = startRedirectUrl(request, oauth);
  if (!dest.url) {
    identityLog("digilocker_start_blocked", { ok: false, reason: dest.reason ?? "config" });
    const fail = new URL("/onboard", origin);
    fail.searchParams.set("digilocker", "error");
    fail.searchParams.set("reason", dest.reason ?? "config");
    return NextResponse.redirect(fail);
  }

  identityLog("digilocker_start", {
    ok: true,
    demo: dest.url.includes("/onboard/digilocker"),
  });
  const response = NextResponse.redirect(dest.url);
  response.cookies.set(DIGILOCKER_OAUTH_COOKIE, encodeOAuthCookie(oauth), cookieOptions());
  return response;
}
