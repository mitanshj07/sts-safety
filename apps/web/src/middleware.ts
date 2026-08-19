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

function isServerActionRequest(request: NextRequest): boolean {
  return (
    request.headers.has("next-action") || request.headers.has("Next-Action")
  );
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
    return redirectWithCookies(request, supabaseResponse, "/login");
  }

  const role = await readRole(
    supabase,
    user.id,
    user.app_metadata["role"] ?? user.user_metadata["role"],
  );
  const home = homePathForRole(role);

  if (pathname === "/login") {
    // Server Actions POST to the current URL. Redirecting them to /home
    // breaks completeSignIn / skipToApp with "unexpected response".
    if (isServerActionRequest(request) || request.method !== "GET") {
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
