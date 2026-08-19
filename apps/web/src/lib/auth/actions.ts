// apps/web/src/lib/auth/actions.ts
"use server";

import { DEFAULT_ITINERARY_PRESET_ID } from "@sts/shared";

import { issueTouristIdentity, saveTouristItinerary } from "@/lib/identity/issuance";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

import { ensureCurrentProfile } from "./ensure-profile";
import { AuthError } from "./errors";
import { homePathForRole, type UserRole } from "./roles";

function actionErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_")
  ) {
    throw error;
  }
  if (error instanceof AuthError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export type CompleteSignInResult =
  | { ok: true; role: UserRole; redirectTo: string }
  | { ok: false; message: string };

export type GuestLoginResult =
  | { ok: true; email: string; password: string }
  | { ok: false; message: string };

/** Public skip path when anonymous auth is disabled on the Supabase project. */
export async function createGuestLogin(): Promise<GuestLoginResult> {
  const admin = tryCreateAdminClient();
  if (!admin) {
    return { ok: false, message: "Guest login is not configured on this deploy." };
  }
  const id = crypto.randomUUID();
  const email = `guest.${id}@demo.sts`;
  const password = `Guest-${id.replace(/-/g, "").slice(0, 12)}-Pass123!`;
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "Guest traveller",
      role: "tourist",
    },
    app_metadata: { provider: "email", providers: ["email"], role: "tourist" },
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, email, password };
}

async function touristLandingPath(profileId: string, role: UserRole): Promise<string> {
  if (role !== "tourist") return homePathForRole(role);
  const admin = tryCreateAdminClient();
  if (!admin) return "/onboard";
  const { data: tourist } = await admin
    .from("tourists")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!tourist?.id) return "/onboard";
  const { data: digitalId } = await admin
    .from("digital_ids")
    .select("id")
    .eq("tourist_id", tourist.id)
    .in("status", ["pending", "active"])
    .limit(1)
    .maybeSingle();
  return digitalId?.id ? "/home" : "/onboard";
}

export async function completeSignIn(): Promise<CompleteSignInResult> {
  try {
    const profile = await ensureCurrentProfile();
    return {
      ok: true,
      role: profile.role,
      redirectTo: await touristLandingPath(profile.id, profile.role),
    };
  } catch (error) {
    return { ok: false, message: actionErrorMessage(error, "Could not finish sign-in") };
  }
}

export async function skipToApp(itineraryPresetId?: string): Promise<CompleteSignInResult> {
  try {
    const profile = await ensureCurrentProfile();
    if (profile.role !== "tourist") {
      return {
        ok: true,
        role: profile.role,
        redirectTo: homePathForRole(profile.role),
      };
    }
    const preset = itineraryPresetId ?? DEFAULT_ITINERARY_PRESET_ID;
    const now = Date.now();
    const tripStart = new Date(now).toISOString();
    const tripEnd = new Date(now + 7 * 86400000).toISOString();
    const admin = tryCreateAdminClient();
    if (admin) {
      const { data: tourist } = await admin
        .from("tourists")
        .select("id, trip_start, trip_end")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (tourist?.id) {
        const [{ data: digitalId }, { data: itinerary }] = await Promise.all([
          admin
            .from("digital_ids")
            .select("id")
            .eq("tourist_id", tourist.id)
            .in("status", ["pending", "active"])
            .limit(1)
            .maybeSingle(),
          admin
            .from("itineraries")
            .select("id")
            .eq("tourist_id", tourist.id)
            .eq("active", true)
            .limit(1)
            .maybeSingle(),
        ]);
        if (digitalId?.id && !itinerary?.id) {
          await saveTouristItinerary(
            String(tourist.id),
            { itineraryPresetId: preset },
            String(tourist.trip_start ?? tripStart),
            String(tourist.trip_end ?? tripEnd),
          );
        }
        if (digitalId?.id) {
          return { ok: true, role: "tourist", redirectTo: "/home" };
        }
      }
    }
    await issueTouristIdentity({
      skipKyc: true,
      profileId: profile.id,
      name: profile.display_name || "Guest traveller",
      nationality: "IN",
      tripStart,
      tripEnd,
      itineraryPresetId: preset,
    });
    return { ok: true, role: "tourist", redirectTo: "/home" };
  } catch (error) {
    return { ok: false, message: actionErrorMessage(error, "Could not skip onboarding") };
  }
}
