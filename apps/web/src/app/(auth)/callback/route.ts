// apps/web/src/app/(auth)/callback/route.ts
import { NextResponse } from "next/server";

import { ensureProfileForUser } from "@/lib/auth/ensure-profile";
import { callbackSearchSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { homePathForRole } from "@/lib/auth/roles";

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

  const { code, error, error_description } = parsed.data;
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
  let destinationPath = homePathForRole(profile.role);
  if (profile.role === "tourist") {
    const admin = tryCreateAdminClient();
    const tourist = admin
      ? await admin
          .from("tourists")
          .select("id")
          .eq("profile_id", profile.id)
          .maybeSingle()
      : { data: null };
    const digital = tourist.data?.id && admin
      ? await admin
          .from("digital_ids")
          .select("id")
          .eq("tourist_id", tourist.data.id)
          .in("status", ["pending", "active"])
          .limit(1)
          .maybeSingle()
      : { data: null };
    destinationPath = digital.data?.id ? "/home" : "/onboard";
  }
  const destination = new URL(destinationPath, origin);
  return NextResponse.redirect(destination);
}
