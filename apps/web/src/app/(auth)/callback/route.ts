// apps/web/src/app/(auth)/callback/route.ts
import { NextResponse } from "next/server";

import { ensureProfileForUser } from "@/lib/auth/ensure-profile";
import {
  nextPathForRole,
  resolvePostAuthTarget,
  sanitizeNextPath,
} from "@/lib/auth/next-path";
import { postAuthPath } from "@/lib/auth/post-login";
import { callbackSearchSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = callbackSearchSchema.safeParse({
    code: url.searchParams.get("code") ?? undefined,
    error: url.searchParams.get("error") ?? undefined,
    error_description: url.searchParams.get("error_description") ?? undefined,
    next: url.searchParams.get("next") ?? undefined,
  });

  const origin = url.origin;
  const login = new URL("/login", origin);

  if (!parsed.success) {
    login.searchParams.set("error", "Invalid callback payload");
    return NextResponse.redirect(login);
  }

  const { code, error, error_description, next } = parsed.data;
  if (next) {
    const preserved = sanitizeNextPath(next);
    if (preserved) login.searchParams.set("next", preserved);
  }
  if (error) {
    login.searchParams.set("error", error_description ?? error);
    return NextResponse.redirect(login);
  }

  if (!code) {
    login.searchParams.set("error", "Missing auth code");
    return NextResponse.redirect(login);
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    login.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(login);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    login.searchParams.set("error", "Session not established");
    return NextResponse.redirect(login);
  }

  const profile = await ensureProfileForUser(user);
  const home = await postAuthPath({
    role: profile.role,
    profileId: profile.id,
    email: user.email,
  });
  const requested = nextPathForRole(next, profile.role);
  const target = resolvePostAuthTarget(home, requested);
  return NextResponse.redirect(new URL(target, origin));
}
