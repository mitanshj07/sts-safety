// apps/web/src/lib/auth/ensure-profile.ts
import type { User } from "@supabase/supabase-js";

import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, UserRole } from "@/lib/supabase/database.types";

import { AuthError } from "./errors";
import { isGuestTouristEmail } from "./guest-email";
import { parseUserRole } from "./roles";
import { profileRowSchema } from "./schemas";

function isAnonymousUser(user: User): boolean {
  return user.is_anonymous === true || !user.email;
}

function needsDemoTouristRow(user: User): boolean {
  return isAnonymousUser(user) || isGuestTouristEmail(user.email);
}

function displayNameFor(user: User): string {
  const meta = user.user_metadata;
  const fromMeta =
    typeof meta["display_name"] === "string" ? meta["display_name"] : null;
  const fromFull =
    typeof meta["full_name"] === "string" ? meta["full_name"] : null;

  if (fromMeta && fromMeta.length > 0) return fromMeta;
  if (fromFull && fromFull.length > 0) return fromFull;

  // Anonymous users have no email — never derive a name from a missing address.
  if (isAnonymousUser(user)) {
    return "Demo Tourist";
  }

  const email = user.email;
  if (email) {
    const local = email.split("@")[0];
    if (local && local.length > 0) return local;
  }

  return "User";
}

function roleFor(user: User): UserRole {
  const fromApp = parseUserRole(user.app_metadata["role"]);
  if (fromApp) return fromApp;
  const fromUser = parseUserRole(user.user_metadata["role"]);
  if (fromUser) return fromUser;
  return "tourist";
}

function localeFor(user: User): string {
  const meta = user.user_metadata["locale"];
  if (typeof meta === "string" && meta.length > 0) return meta;
  return process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en";
}

/**
 * Idempotent profile upsert, backed by the `handle_new_user` trigger.
 * Anonymous (no-email) demo tourists also get a `tourists` row so /home works
 * without waiting for KYC onboarding.
 */
export async function ensureProfileForUser(user: User): Promise<ProfileRow> {
  const supabase = await createClient();
  const admin = tryCreateAdminClient();
  const reader = admin ?? supabase;
  const { data: existing, error: readError } = await reader
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to read profile: ${readError.message}`);
  }

  if (existing) {
    const parsed = profileRowSchema.safeParse(existing);
    if (!parsed.success) {
      throw new Error(
        `Failed to read profile: ${parsed.error.issues[0]?.message ?? "invalid row"}`,
      );
    }
    if (needsDemoTouristRow(user)) {
      await ensureDemoTouristRow(user.id);
    }
    return parsed.data;
  }

  const writer = admin ?? supabase;
  const insert = {
    id: user.id,
    role: roleFor(user),
    display_name: displayNameFor(user),
    locale: localeFor(user),
  };

  const { data: created, error: writeError } = await writer
    .from("profiles")
    .upsert(insert, { onConflict: "id" })
    .select("*")
    .single();

  if (writeError || !created) {
    throw new Error(
      `Failed to create profile: ${writeError?.message ?? "unknown error"}`,
    );
  }

  const createdParsed = profileRowSchema.safeParse(created);
  if (!createdParsed.success) {
    throw new Error(
      `Failed to create profile: ${createdParsed.error.issues[0]?.message ?? "invalid row"}`,
    );
  }

  if (needsDemoTouristRow(user)) {
    await ensureDemoTouristRow(user.id);
  }

  return createdParsed.data;
}

async function ensureDemoTouristRow(profileId: string): Promise<void> {
  const admin = tryCreateAdminClient();
  const supabase = admin ?? (await createClient());
  const { error } = await supabase.rpc("ensure_demo_tourist", {
    p_profile_id: profileId,
  });
  if (error) {
    throw new Error(`Failed to provision demo tourist: ${error.message}`);
  }
}

export async function ensureCurrentProfile(): Promise<ProfileRow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AuthError("Authentication required", "unauthenticated", 401);
  }
  return ensureProfileForUser(user);
}
