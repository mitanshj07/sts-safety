import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { DEMO_TOURIST_DISPLAY_NAME } from "@/lib/auth/demo";
import { ensureProfileForUser } from "@/lib/auth/ensure-profile";
import { GUEST_EMAIL_DOMAIN } from "@/lib/auth/guest-email";
import { getPrincipal } from "@/lib/auth/guards";
import { sanitizeNextPath } from "@/lib/auth/next-path";
import { landingPathForTouristUser } from "@/lib/auth/post-login";
import { homePathForRole } from "@/lib/auth/roles";
import { identityLog } from "@/lib/identity/log";
import { createAdminClient, tryCreateAdminClient } from "@/lib/supabase/admin";
import { createSupabaseOnResponse } from "@/lib/supabase/route";

export async function tryGetTouristUserId(request: Request): Promise<string | null> {
  try {
    const principal = await getPrincipal(request);
    return principal?.role === "tourist" ? principal.id : null;
  } catch {
    return null;
  }
}

/**
 * Puts a tourist session on `response` cookies.
 * Prefers anonymous Auth; if the project has it disabled, mints a confirmed
 * guest user with the service role and signs that user in.
 */
export async function ensureTouristSessionOnResponse(args: {
  request: NextRequest;
  response: NextResponse;
  displayName: string;
}): Promise<{ userId: string } | null> {
  const existing = await tryGetTouristUserId(args.request);
  if (existing) return { userId: existing };

  const supabase = createSupabaseOnResponse(args.request, args.response);
  if (!supabase) {
    identityLog("guest_session_no_config", { ok: false });
    return null;
  }

  const name = args.displayName.trim() || "Demo Tourist";
  const { data: anon, error: anonError } = await supabase.auth.signInAnonymously({
    options: {
      data: {
        display_name: name,
        role: "tourist",
      },
    },
  });
  if (!anonError && anon.user) {
    const admin = tryCreateAdminClient();
    if (admin) {
      const { error: roleError } = await admin.auth.admin.updateUserById(anon.user.id, {
        app_metadata: { role: "tourist" },
      });
      if (roleError) {
        identityLog("guest_anon_role_failed", { ok: false, error: roleError.message });
      }
    }
    try {
      await ensureProfileForUser(anon.user);
    } catch {
      identityLog("guest_anon_profile_failed", { ok: false });
    }
    return { userId: anon.user.id };
  }

  identityLog("guest_anon_unavailable", {
    ok: false,
    error: anonError?.message ?? "anonymous_disabled",
  });

  try {
    const admin = createAdminClient();
    const email = `guest-${crypto.randomUUID()}@${GUEST_EMAIL_DOMAIN}`;
    const password = `${crypto.randomUUID()}Aa1!`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name, role: "tourist" },
      app_metadata: { role: "tourist" },
    });
    if (createError || !created.user) {
      identityLog("guest_create_failed", {
        ok: false,
        error: createError?.message ?? "create_user_failed",
      });
      return null;
    }

    const { data: signedIn, error: passwordError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (passwordError || !signedIn.user) {
      identityLog("guest_password_signin_failed", {
        ok: false,
        error: passwordError?.message ?? "signin_failed",
      });
      return null;
    }

    try {
      await ensureProfileForUser(signedIn.user);
    } catch {
      identityLog("guest_profile_failed", { ok: false });
    }
    identityLog("guest_session_ok", { ok: true });
    return { userId: signedIn.user.id };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "guest_session_failed";
    identityLog("guest_session_failed", { ok: false, error: message });
    return null;
  }
}

export function copyResponseCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

/** GET /api/auth/guest — start an anonymous (or fallback guest) tourist session and enter the app. */
export async function redirectWithTouristGuestSession(
  request: NextRequest,
): Promise<NextResponse> {
  const requested = sanitizeNextPath(request.nextUrl.searchParams.get("next"));

  try {
    const principal = await getPrincipal(request);
    if (principal) {
      const dest =
        principal.role === "tourist"
          ? await landingPathForTouristUser(principal.id, requested)
          : homePathForRole(principal.role);
      return NextResponse.redirect(new URL(dest, request.url));
    }
  } catch {
    // Missing profile — mint a tourist session below.
  }

  const holder = NextResponse.json({ ok: true });
  const minted = await ensureTouristSessionOnResponse({
    request,
    response: holder,
    displayName: DEMO_TOURIST_DISPLAY_NAME,
  });
  if (!minted) {
    const login = new URL("/login", request.url);
    login.searchParams.set("tab", "tourist");
    login.searchParams.set(
      "error",
      "Could not start a guest tourist session. Enable anonymous sign-ins in Auth providers.",
    );
    return copyResponseCookies(holder, NextResponse.redirect(login));
  }

  const dest = await landingPathForTouristUser(minted.userId, requested);
  return copyResponseCookies(holder, NextResponse.redirect(new URL(dest, request.url)));
}
