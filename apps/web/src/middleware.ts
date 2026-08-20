// apps/web/src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  homePathForRole,
  isCommandPath,
  isPublicPath,
  isTouristPath,
  parseUserRole,
  type UserRole,
} from "@/lib/auth/roles";
import {
  clientKey,
  isPublicApiPath,
  rateLimit,
} from "@/lib/security/rate-limit";
import { tryGetSupabasePublicConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

function isOnboardPath(pathname: string): boolean {
  return pathname === "/onboard" || pathname.startsWith("/onboard/");
}

function hasDigilockerKycCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get("sts_dl_kyc")?.value);
}

function copyCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

function redirectWithCookies(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirectResponse = NextResponse.redirect(url);
  return copyCookies(supabaseResponse, redirectResponse);
}

async function readRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  metadataRole: unknown,
): Promise<UserRole> {
  const fromJwt = parseUserRole(metadataRole);
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return parseUserRole(data?.role) ?? fromJwt ?? "tourist";
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const tight = isPublicApiPath(pathname);
    const result = rateLimit({
      key: `${clientKey(request)}:${tight ? "public" : "api"}`,
      capacity: tight ? 40 : 180,
      refillPerSec: tight ? 0.5 : 3,
    });
    if (!result.ok) {
      return new NextResponse(JSON.stringify({ ok: false, error: "rate_limited" }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(result.retryAfterSec),
        },
      });
    }
  }

  let supabaseResponse = NextResponse.next({ request });
  const config = tryGetSupabasePublicConfig();

  if (!config) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isPublicPath(pathname)) {
      return supabaseResponse;
    }
    if (isOnboardPath(pathname) && hasDigilockerKycCookie(request)) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-sts-digilocker-onboard", "1");
      const next = NextResponse.next({ request: { headers: requestHeaders } });
      supabaseResponse.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
      return next;
    }
    return redirectWithCookies(request, supabaseResponse, "/login");
  }

  const role = await readRole(
    supabase,
    user.id,
    user.app_metadata["role"] ?? user.user_metadata["role"],
  );
  const home = homePathForRole(role);

  if (pathname === "/login") {
    // Keep POST on /login so sign-in server actions can finish. Redirecting them
    // to /home or /dashboard yields an empty action payload and a failed login.
    if (request.method !== "GET") {
      return supabaseResponse;
    }
    return redirectWithCookies(request, supabaseResponse, home);
  }

  if (role === "tourist" && isCommandPath(pathname)) {
    return redirectWithCookies(request, supabaseResponse, "/home");
  }

  if (role !== "tourist" && isTouristPath(pathname)) {
    return redirectWithCookies(request, supabaseResponse, "/dashboard");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|js|mjs|geojson|json)$).*)",
  ],
};
